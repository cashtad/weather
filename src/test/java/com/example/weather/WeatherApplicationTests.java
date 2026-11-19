package com.example.weather;

import com.example.weather.entity.FavoriteLocation;
import com.example.weather.entity.User;
import com.example.weather.repository.*;
import com.example.weather.security.JwtService;
import com.example.weather.security.SecurityErrorHandler;
import com.example.weather.service.GeoService;
import com.example.weather.service.WeatherService;
import com.example.weather.dto.WeatherResponse;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import java.util.concurrent.atomic.AtomicBoolean;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.aMapWithSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                + "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration,"
                + "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration",
        "openweather.api-key=not-used-in-tests",
        "jwt.expiration-ms=86400000"
})
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Import(WeatherApplicationTests.TestSecurity.class)
class WeatherApplicationTests {

    private static final AtomicBoolean DATABASE_UP = new AtomicBoolean(true);
    private static final byte[] KEY = new byte[32];
    static { new SecureRandom().nextBytes(KEY); }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("jwt.secret", () -> Base64.getEncoder().encodeToString(KEY));
    }

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @Autowired PasswordEncoder encoder;
    @MockitoBean UserRepository users;
    @MockitoBean FavoriteLocationRepository favorites;
    @MockitoBean WeatherCacheRepository cache;
    @MockitoBean WeatherService weather;
    @MockitoBean GeoService geo;

    private final Map<String, User> storedUsers = new HashMap<>();
    private final Map<UUID, FavoriteLocation> storedFavorites = new HashMap<>();
    private User user;
    private String bearer;

    @BeforeEach
    void setUp() {
        DATABASE_UP.set(true);
        storedUsers.clear();
        storedFavorites.clear();
        user = User.builder().id(UUID.randomUUID()).email("user@example.test")
                .passwordHash(encoder.encode("test-password")).createdAt(Instant.now()).build();
        storedUsers.put(user.getEmail(), user);
        bearer = "Bearer " + jwtService.generateToken(user.getEmail());
        when(users.findByEmail(anyString())).thenAnswer(call -> Optional.ofNullable(storedUsers.get(call.getArgument(0))));
        when(users.existsByEmail(anyString())).thenAnswer(call -> storedUsers.containsKey(call.getArgument(0)));
        when(users.save(any(User.class))).thenAnswer(call -> {
            User saved = call.getArgument(0);
            saved.setId(UUID.randomUUID());
            storedUsers.put(saved.getEmail(), saved);
            return saved;
        });
        when(favorites.findById(any(UUID.class))).thenAnswer(call -> Optional.ofNullable(storedFavorites.get(call.getArgument(0))));
        when(favorites.findAllByUser(any(User.class))).thenAnswer(call -> storedFavorites.values().stream()
                .filter(f -> f.getUser().getId().equals(((User) call.getArgument(0)).getId())).toList());
        when(favorites.save(any(FavoriteLocation.class))).thenAnswer(call -> {
            FavoriteLocation saved = call.getArgument(0);
            saved.setId(UUID.randomUUID());
            storedFavorites.put(saved.getId(), saved);
            return saved;
        });
        doAnswer(call -> { storedFavorites.remove(((FavoriteLocation) call.getArgument(0)).getId()); return null; })
                .when(favorites).delete(any(FavoriteLocation.class));
    }

    @Test
    void profileContainsOnlyPublicFields() throws Exception {
        mvc.perform(get("/api/v1/user/me").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$", aMapWithSize(3)))
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.email").value(user.getEmail()))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/user/me", "/api/v1/favorites"})
    void missingAuthenticationReturnsJson401(String path) throws Exception {
        error(mvc.perform(get(path)), 401, "UNAUTHORIZED", path);
    }

    @ParameterizedTest
    @ValueSource(strings = {"malformed", "expired", "signature", "deleted", "empty", "subject"})
    void invalidAuthenticationReturnsJson401(String kind) throws Exception {
        String token;
        switch (kind) {
            case "expired" -> token = Jwts.builder().subject(user.getEmail())
                    .expiration(Date.from(Instant.now().minusSeconds(60)))
                    .signWith(Keys.hmacShaKeyFor(KEY), Jwts.SIG.HS256).compact();
            case "signature" -> {
                byte[] otherKey = new byte[32]; new SecureRandom().nextBytes(otherKey);
                token = Jwts.builder().subject(user.getEmail())
                        .signWith(Keys.hmacShaKeyFor(otherKey), Jwts.SIG.HS256).compact();
            }
            case "deleted" -> token = jwtService.generateToken("deleted@example.test");
            case "subject" -> token = Jwts.builder().signWith(Keys.hmacShaKeyFor(KEY), Jwts.SIG.HS256).compact();
            case "empty" -> token = "";
            default -> token = "not.a.valid.token";
        }
        error(mvc.perform(get("/api/v1/user/me").header("Authorization", "Bearer " + token)),
                401, "UNAUTHORIZED", "/api/v1/user/me");
    }

    @Test
    void registrationAndLoginRemainCompatible() throws Exception {
        String body = "{\"email\":\"new@example.test\",\"password\":\"test-password\"}";
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").isString());
        assertThat(encoder.matches("test-password", storedUsers.get("new@example.test").getPasswordHash())).isTrue();
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").isString());
        error(mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body)),
                409, "EMAIL_ALREADY_REGISTERED", "/api/v1/auth/register");
    }

    @Test
    void wrongPasswordReturns401() throws Exception {
        error(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"user@example.test\",\"password\":\"wrong\"}")),
                401, "UNAUTHORIZED", "/api/v1/auth/login");
    }

    @Test
    void unavailableUserStoreReturns503DuringLogin() throws Exception {
        when(users.findByEmail(user.getEmail()))
                .thenThrow(new DataAccessResourceFailureException("Private database diagnostics"));
        String path = "/api/v1/auth/login";
        error(mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"user@example.test\",\"password\":\"test-password\"}")),
                503, "HTTP_503", path)
                .andExpect(jsonPath("$.message").value("Authentication temporarily unavailable"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/user/me", "/api/v1/favorites"})
    void validBearerStillWorksAfterTemporaryUserStoreFailure(String path) throws Exception {
        when(users.findByEmail(user.getEmail()))
                .thenThrow(new DataAccessResourceFailureException("Private database diagnostics"))
                .thenReturn(Optional.of(user));

        error(mvc.perform(get(path).header("Authorization", bearer)), 503, "HTTP_503", path)
                .andExpect(jsonPath("$.message").value("Authentication temporarily unavailable"));
        mvc.perform(get(path).header("Authorization", bearer)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{", "{\"email\":{},\"password\":\"test-password\"}"})
    void invalidJsonReturns400(String body) throws Exception {
        error(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)),
                400, "INVALID_REQUEST", "/api/v1/auth/login");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"email\":\"invalid\",\"password\":\"test-password\"}",
            "{\"email\":\"user@example.test\",\"password\":\"\"}", "{}"})
    void invalidRegistrationReturns400(String body) throws Exception {
        error(mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body)),
                400, "VALIDATION_ERROR", "/api/v1/auth/register");
    }

    @Test
    void oversizedInputAndMultibytePasswordAreRejected() throws Exception {
        for (String email : List.of("a".repeat(256) + "@example.test", "new@example.test")) {
            String password = email.startsWith("a") ? "test-password" : "\u00e9".repeat(40);
            mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        }
    }

    @Test
    void passwordCharacterLimitIsEnforcedOnRegistrationAndLogin() throws Exception {
        for (String endpoint : List.of("register", "login")) {
            String path = "/api/v1/auth/" + endpoint;
            error(mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"user@example.test\",\"password\":\"" + "x".repeat(73) + "\"}")),
                    400, "VALIDATION_ERROR", path);
        }
    }

    @ParameterizedTest
    @CsvSource({"country,11", "state,256"})
    void optionalFavoriteStringsRespectSchemaLengths(String field, int length) throws Exception {
        String body = favoriteJson(0, 0).replace("}", ",\"" + field + "\":\"" + "x".repeat(length) + "\"}");
        error(mvc.perform(post("/api/v1/favorites").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(body)),
                400, "VALIDATION_ERROR", "/api/v1/favorites");
    }

    @ParameterizedTest
    @ValueSource(strings = {"current", "hourly", "daily", "all"})
    void weatherRangesUseMvcMethodValidation(String endpoint) throws Exception {
        String path = "/api/v1/weather/" + endpoint;
        for (String[] coordinates : new String[][] {{"91", "0"}, {"-91", "0"}, {"0", "181"}, {"0", "-181"}, {"NaN", "0"}}) {
            error(mvc.perform(get(path).param("lat", coordinates[0]).param("lon", coordinates[1])),
                    400, "VALIDATION_ERROR", path);
        }
        verifyNoInteractions(weather);
    }

    @Test
    void missingAndInvalidQueryTypesReturn400() throws Exception {
        String path = "/api/v1/weather/current";
        error(mvc.perform(get(path).param("lat", "0")), 400, "INVALID_REQUEST", path);
        error(mvc.perform(get(path).param("lat", "abc").param("lon", "0")), 400, "INVALID_REQUEST", path);
    }

    @ParameterizedTest
    @CsvSource({"-90,-180", "90,180", "0,0"})
    void boundaryCoordinatesAreAccepted(double lat, double lon) throws Exception {
        when(weather.getCurrent(lat, lon)).thenReturn(new WeatherResponse());
        mvc.perform(get("/api/v1/weather/current").param("lat", String.valueOf(lat)).param("lon", String.valueOf(lon)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/favorites").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content(favoriteJson(lat, lon))).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void blankGeocodingSearchIsRejected(String name) throws Exception {
        error(mvc.perform(get("/api/v1/geo/search").param("name", name)),
                400, "VALIDATION_ERROR", "/api/v1/geo/search");
        verifyNoInteractions(geo);
    }

    @Test
    void missingAndOversizedSearchAreRejected() throws Exception {
        error(mvc.perform(get("/api/v1/geo/search")), 400, "INVALID_REQUEST", "/api/v1/geo/search");
        error(mvc.perform(get("/api/v1/geo/search").param("name", "a".repeat(256))),
                400, "VALIDATION_ERROR", "/api/v1/geo/search");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"name\":\"City\",\"displayName\":\"City\",\"lat\":999,\"lon\":0}",
            "{\"name\":\"City\",\"displayName\":\"City\",\"lat\":0,\"lon\":999}"})
    void invalidFavoritesAreRejected(String body) throws Exception {
        error(mvc.perform(post("/api/v1/favorites").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(body)),
                400, "VALIDATION_ERROR", "/api/v1/favorites");
        verify(favorites, never()).save(any());
    }

    @Test
    void favoriteFieldTypesAndLengthsAreChecked() throws Exception {
        error(mvc.perform(post("/api/v1/favorites").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"City\",\"displayName\":\"City\",\"lat\":\"abc\",\"lon\":0}")),
                400, "INVALID_REQUEST", "/api/v1/favorites");
        String body = favoriteJson(0, 0).replace("City", "a".repeat(256));
        error(mvc.perform(post("/api/v1/favorites").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(body)),
                400, "VALIDATION_ERROR", "/api/v1/favorites");
    }

    @Test
    void ownerCanDeleteFavorite() throws Exception {
        FavoriteLocation location = favorite(user);
        mvc.perform(delete("/api/v1/favorites/" + location.getId()).header("Authorization", bearer))
                .andExpect(status().isOk());
        assertThat(storedFavorites).doesNotContainKey(location.getId());
        verify(favorites).delete(location);
    }

    @Test
    void missingFavoriteReturns404() throws Exception {
        String path = "/api/v1/favorites/" + UUID.randomUUID();
        error(mvc.perform(delete(path).header("Authorization", bearer)), 404, "HTTP_404", path);
        verify(favorites, never()).delete(any());
    }

    @Test
    void otherUsersFavoriteIsHiddenAndRetained() throws Exception {
        User other = User.builder().id(UUID.randomUUID()).build();
        FavoriteLocation location = favorite(other);
        String path = "/api/v1/favorites/" + location.getId();
        error(mvc.perform(delete(path).header("Authorization", bearer)), 404, "HTTP_404", path);
        assertThat(storedFavorites).containsEntry(location.getId(), location);
        verify(favorites, never()).delete(any());
    }

    @Test
    void malformedFavoriteIdReturns400() throws Exception {
        String path = "/api/v1/favorites/not-a-uuid";
        error(mvc.perform(delete(path).header("Authorization", bearer)), 400, "INVALID_REQUEST", path);
    }

    @Test
    @WithMockUser(authorities = "USER")
    void accessDeniedUsesSecurityJsonContract() throws Exception {
        error(mvc.perform(get("/test/admin")), 403, "FORBIDDEN", "/test/admin");
    }

    @Test
    void unexpectedFailureDoesNotExposeDetails() throws Exception {
        when(weather.getCurrent(0, 0)).thenThrow(new IllegalStateException("Internal diagnostic detail"));
        error(mvc.perform(get("/api/v1/weather/current").param("lat", "0").param("lon", "0")),
                500, "INTERNAL_ERROR", "/api/v1/weather/current")
                .andExpect(jsonPath("$.message").value("Unexpected error"));
    }

    private ResultActions error(ResultActions result, int status, String code, String path) throws Exception {
        return result.andExpect(status().is(status)).andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", aMapWithSize(5))).andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.path").value(path))
                .andExpect(jsonPath("$.timestamp").isString()).andExpect(jsonPath("$.message").isString())
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    private FavoriteLocation favorite(User owner) {
        FavoriteLocation location = FavoriteLocation.builder().id(UUID.randomUUID()).user(owner)
                .name("City").displayName("City").createdAt(Instant.now()).build();
        storedFavorites.put(location.getId(), location);
        return location;
    }

    private String favoriteJson(double lat, double lon) {
        return "{\"name\":\"City\",\"displayName\":\"City\",\"lat\":" + lat + ",\"lon\":" + lon + "}";
    }

    @Test
    void healthEndpointsArePublicAndHideDetails() throws Exception {
        for (String path : List.of("/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness")) {
            mvc.perform(get(path)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"))
                    .andExpect(jsonPath("$.components").doesNotExist()).andExpect(jsonPath("$.details").doesNotExist());
        }
    }

    @Test
    void readinessIncludesDatabaseButLivenessDoesNot() throws Exception {
        DATABASE_UP.set(false);
        try {
            mvc.perform(get("/actuator/health/readiness")).andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.status").value("DOWN"));
            mvc.perform(get("/actuator/health/liveness")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("UP"));
        } finally {
            DATABASE_UP.set(true);
        }
    }

    @Test
    void administrativeEndpointsAreNotPublicOrExposed() throws Exception {
        error(mvc.perform(get("/actuator/env")), 401, "UNAUTHORIZED", "/actuator/env");
        mvc.perform(get("/actuator/env").header("Authorization", bearer)).andExpect(status().isNotFound());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestSecurity {
        @Bean("dbHealthIndicator")
        HealthIndicator databaseHealth() {
            return () -> DATABASE_UP.get() ? Health.up().build() : Health.down().build();
        }

        @Bean
        @Order(0)
        SecurityFilterChain adminChain(HttpSecurity http, SecurityErrorHandler errors) throws Exception {
            return http.securityMatcher("/test/admin")
                    .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                    .authorizeHttpRequests(auth -> auth.anyRequest().hasAuthority("ADMIN"))
                    .exceptionHandling(ex -> ex.authenticationEntryPoint(errors).accessDeniedHandler(errors))
                    .build();
        }
    }
}
