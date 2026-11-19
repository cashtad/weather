package com.example.weather.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.security.SecureRandom;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withInitializer(ctx -> {
                ctx.getEnvironment().getPropertySources().remove("systemEnvironment");
                ctx.getEnvironment().getPropertySources().remove("systemProperties");
            })
            .withUserConfiguration(JwtService.class).withPropertyValues("jwt.expiration-ms=86400000");

    @Test
    void missingSecretFailsContextInitialization() {
        context.run(ctx -> assertThat(ctx).hasFailed()
                .getFailure().hasRootCauseMessage("JWT signing key (jwt.secret / JWT_SECRET) must be configured"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "not-base64!", "c2hvcnQ="})
    void invalidSecretFailsContextInitializationWithoutDisclosingValue(String secret) {
        context.withPropertyValues("jwt.secret=" + secret).run(ctx -> {
            assertThat(ctx).hasFailed();
            Throwable cause = ctx.getStartupFailure();
            while (cause.getCause() != null) { cause = cause.getCause(); }
            assertThat(cause).isInstanceOf(IllegalArgumentException.class);
            assertThat(cause.getMessage()).startsWith("JWT signing key");
            if (!secret.isBlank()) { assertThat(cause.getMessage()).doesNotContain(secret); }
        });
    }

    @Test
    void validSecretInitializesAndRoundTripsExistingTokenFormat() {
        byte[] key = new byte[32]; new SecureRandom().nextBytes(key);
        context.withPropertyValues("jwt.secret=" + Base64.getEncoder().encodeToString(key)).run(ctx -> {
            assertThat(ctx).hasNotFailed();
            JwtService service = ctx.getBean(JwtService.class);
            assertThat(service.extractEmail(service.generateToken("user@example.test"))).isEqualTo("user@example.test");
        });
    }
}
