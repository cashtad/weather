package com.example.weather.repository;

import com.example.weather.entity.WeatherCache;
import com.example.weather.entity.WeatherCacheType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface WeatherCacheRepository extends JpaRepository<WeatherCache, UUID> {
    Optional<WeatherCache> findByLatAndLonAndType(double lat, double lon, WeatherCacheType type);

    // Flush before native SQL and discard stale managed cache snapshots afterwards.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO weather_cache (id, lat, lon, type, data_json, updated_at)
            VALUES (:id, :lat, :lon, :type, CAST(:data AS jsonb), :updatedAt)
            ON CONFLICT (lat, lon, type) DO UPDATE
            SET data_json = EXCLUDED.data_json, updated_at = EXCLUDED.updated_at
            """, nativeQuery = true)
    int upsert(@Param("id") UUID id, @Param("lat") double lat, @Param("lon") double lon,
               @Param("type") String type, @Param("data") String data, @Param("updatedAt") Instant updatedAt);
}
