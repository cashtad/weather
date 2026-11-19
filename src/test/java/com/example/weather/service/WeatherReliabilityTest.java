package com.example.weather.service;

import com.example.weather.entity.WeatherCacheType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class WeatherReliabilityTest {
    private MockRestServiceServer server;
    private CacheService cache;
    private WeatherService weather;

    @BeforeEach
    void setUp() {
        RestTemplate http = new RestTemplate();
        server = MockRestServiceServer.bindTo(http).build();
        cache = mock(CacheService.class);
        weather = new WeatherService(new OpenWeatherClient(http, "unused-test-key", "https://weather.example.test"),
                cache, new WeatherResponseProcessor());
    }

    @Test
    void weatherUriPreservesOperationUnitsLanguageAndCoordinates() {
        server.expect(request -> {
            var query = UriComponentsBuilder.fromUri(request.getURI()).build(true).getQueryParams();
            assertThat(request.getURI().getPath()).isEqualTo("/data/3.0/onecall");
            assertThat(query.getFirst("units")).isEqualTo("metric");
            assertThat(query.getFirst("lang")).isEqualTo("en");
            assertThat(query.getFirst("lat")).isEqualTo("0.0");
            assertThat(UriUtils.decode(query.getFirst("exclude"), StandardCharsets.UTF_8))
                    .isEqualTo("minutely,hourly,daily,alerts");
        }).andRespond(withSuccess(validCurrent(), MediaType.APPLICATION_JSON));
        assertThat(weather.getCurrent(0, 0).getCurrent().getDt()).isEqualTo(1700000000L);
        verify(cache).saveCache(eq(0.0), eq(0.0), eq(WeatherCacheType.CURRENT), any());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{", "{}", "[]", "null",
            "{\"lat\":0,\"lon\":0,\"timezone\":\"UTC\",\"timezone_offset\":0}",
            "{\"lat\":0,\"lon\":0,\"timezone\":\"UTC\",\"timezone_offset\":0,\"current\":{\"dt\":1,\"temp\":\"bad\",\"weather\":[{\"id\":800}]}}"})
    void invalidPayloadNeverReplacesCache(String body) {
        server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        assertBadGateway(() -> weather.getCurrent(0, 0));
        verify(cache, never()).saveCache(anyDouble(), anyDouble(), any(), any());
        server.verify();
    }

    @Test
    void allRequiresBothForecastBlocks() {
        server.expect(anything()).andRespond(withSuccess(validCurrent(), MediaType.APPLICATION_JSON));
        assertBadGateway(() -> weather.getAll(0, 0));
        verify(cache, never()).saveCache(anyDouble(), anyDouble(), any(), any());
        server.verify();
    }

    private String validCurrent() {
        return """
                {"lat":0,"lon":0,"timezone":"UTC","timezone_offset":0,
                 "current":{"dt":1700000000,"temp":20,"weather":[{"id":800}]}}
                """;
    }

    private void assertBadGateway(org.assertj.core.api.ThrowableAssert.ThrowingCallable operation) {
        assertThatThrownBy(operation).isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(502));
    }
}
