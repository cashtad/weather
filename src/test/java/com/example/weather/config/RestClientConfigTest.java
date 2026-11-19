package com.example.weather.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;

import static org.assertj.core.api.Assertions.*;

class RestClientConfigTest {
    @Test
    void configuresExplicitTimeoutsWithoutNetworkCalls() {
        var template = new RestClientConfig().restTemplate(Duration.ofSeconds(3), Duration.ofSeconds(10));
        assertThat(ReflectionTestUtils.getField(template.getRequestFactory(), "connectTimeout")).isEqualTo(3000);
        assertThat(ReflectionTestUtils.getField(template.getRequestFactory(), "readTimeout")).isEqualTo(10000);
    }

    @Test
    void rejectsUnboundedTimeouts() {
        assertThatIllegalArgumentException().isThrownBy(() ->
                new RestClientConfig().restTemplate(Duration.ZERO, Duration.ofSeconds(10)));
        assertThatIllegalArgumentException().isThrownBy(() ->
                new RestClientConfig().restTemplate(Duration.ofSeconds(3), Duration.ofSeconds(-1)));
    }
}
