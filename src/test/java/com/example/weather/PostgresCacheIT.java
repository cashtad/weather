package com.example.weather;

import com.example.weather.entity.WeatherCacheType;
import com.example.weather.repository.WeatherCacheRepository;
import com.example.weather.service.CacheService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
class PostgresCacheIT {
    private static final String SCHEMA = "stage2b_it_" + UUID.randomUUID().toString().replace("-", "");
    private static final UUID WINNER = UUID.fromString("00000000-0000-0000-0000-000000000003");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String url = required("TEST_DB_URL");
        String username = required("TEST_DB_USER");
        String password = required("TEST_DB_PASS");
        if (!url.startsWith("jdbc:postgresql:")) {
            throw new IllegalArgumentException("PostgresCacheIT requires an explicitly configured disposable PostgreSQL database");
        }
        // Extensions are database-wide; keep their functions visible across repeated isolated schemas.
        new JdbcTemplate(new DriverManagerDataSource(url, username, password))
                .execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA public");
        Flyway.configure().dataSource(url, username, password).schemas(SCHEMA).defaultSchema(SCHEMA)
                .target("1").load().migrate();
        var dataSource = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?")
                + "currentSchema=" + SCHEMA + ",public", username, password);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.update("""
                INSERT INTO users(id,email,password_hash,created_at)
                VALUES ('10000000-0000-0000-0000-000000000001','migration@example.test','test-only',now())
                """);
        jdbc.update("""
                INSERT INTO favorite_locations(user_id,name,lat,lon,display_name,created_at)
                VALUES ('10000000-0000-0000-0000-000000000001','Preserved',1,2,'Preserved',now())
                """);
        for (int i = 1; i <= 3; i++) {
            jdbc.update("""
                    INSERT INTO weather_cache(id,lat,lon,type,data_json,updated_at)
                    VALUES (?,1,2,'CURRENT',CAST(? AS jsonb),CAST(? AS timestamp))
                    """, UUID.fromString("00000000-0000-0000-0000-00000000000" + i),
                    "{\"marker\":" + i + "}", i == 1 ? "2025-01-01 00:00:00" : "2025-01-02 00:00:00");
        }
        registry.add("spring.datasource.url", () -> dataSource.getUrl());
        registry.add("spring.datasource.username", () -> username);
        registry.add("spring.datasource.password", () -> password);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        byte[] key = new byte[32]; new SecureRandom().nextBytes(key);
        registry.add("jwt.secret", () -> Base64.getEncoder().encodeToString(key));
        registry.add("openweather.api-key", () -> "not-used-in-postgres-tests");
    }

    @Autowired CacheService cache;
    @Autowired WeatherCacheRepository repository;
    @Autowired JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void migratesV1DuplicatesDeterministicallyAndPreservesUserData() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success AND version IN ('1','2')", Integer.class))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT id FROM weather_cache WHERE lat=1 AND lon=2 AND type='CURRENT'", UUID.class))
                .isEqualTo(WINNER);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM favorite_locations", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO weather_cache(lat,lon,type,data_json,updated_at) VALUES(1,2,'CURRENT','{}',now())
                """)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void atomicInsertUpdateAndJsonbRoundTripKeepOneRowAndStableId() throws Exception {
        cache.saveCache(3, 4, WeatherCacheType.CURRENT, mapper.readTree("{\"marker\":1}"));
        var first = cache.getFreshCache(3, 4, WeatherCacheType.CURRENT).orElseThrow();
        for (int i = 2; i <= 5; i++) {
            cache.saveCache(3, 4, WeatherCacheType.CURRENT, mapper.createObjectNode().put("marker", i));
        }
        var refreshed = cache.getFreshCache(3, 4, WeatherCacheType.CURRENT).orElseThrow();
        assertThat(refreshed.getId()).isEqualTo(first.getId());
        assertThat(refreshed.getDataJson().get("marker").asInt()).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM weather_cache WHERE lat=3 AND lon=4", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT jsonb_typeof(data_json) FROM weather_cache WHERE lat=3 AND lon=4", String.class))
                .isEqualTo("object");
    }

    @Test
    void expiredCacheMissCanBeRefreshedWithoutDeletingItsRow() {
        cache.saveCache(5, 6, WeatherCacheType.ALL, mapper.createObjectNode().put("marker", "old"));
        UUID id = repository.findByLatAndLonAndType(5, 6, WeatherCacheType.ALL).orElseThrow().getId();
        jdbc.update("UPDATE weather_cache SET updated_at=? WHERE id=?", Timestamp.from(Instant.now().minusSeconds(86400)), id);
        assertThat(cache.getFreshCache(5, 6, WeatherCacheType.ALL)).isEmpty();
        cache.saveCache(5, 6, WeatherCacheType.ALL, mapper.createObjectNode().put("marker", "new"));
        var refreshed = cache.getFreshCache(5, 6, WeatherCacheType.ALL).orElseThrow();
        assertThat(refreshed.getId()).isEqualTo(id);
        assertThat(refreshed.getDataJson().get("marker").asText()).isEqualTo("new");
    }

    @Test
    void concurrentIndependentTransactionsCannotCreateDuplicateKeys() throws Exception {
        var executor = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> writes = new ArrayList<>();
        try {
            for (int i = 0; i < 32; i++) {
                int marker = i;
                writes.add(executor.submit(() -> {
                    try {
                        if (!start.await(10, TimeUnit.SECONDS)) { throw new IllegalStateException("Start barrier timed out"); }
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(ex);
                    }
                    cache.saveCache(7, 8, WeatherCacheType.HOURLY, mapper.createObjectNode().put("marker", marker));
                }));
            }
            start.countDown();
            for (Future<?> write : writes) { write.get(30, TimeUnit.SECONDS); }
        } finally {
            executor.shutdownNow();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM weather_cache WHERE lat=7 AND lon=8", Integer.class)).isEqualTo(1);
        var result = cache.getFreshCache(7, 8, WeatherCacheType.HOURLY).orElseThrow();
        assertThat(result.getDataJson().get("marker").asInt()).isBetween(0, 31);
    }

    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Set " + key + " for the disposable PostgreSQL integration test environment");
        }
        return value;
    }
}
