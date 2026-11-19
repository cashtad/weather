package com.example.weather.service;

import com.example.weather.dto.WeatherResponse;
import com.example.weather.entity.WeatherCache;
import com.example.weather.entity.WeatherCacheType;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.net.URI;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WeatherServiceTest {

    @Test
    void providerMappingAndCacheRoundTripPreserveUtc() {
        RestTemplate http = mock(RestTemplate.class);
        CacheService cache = mock(CacheService.class);
        WeatherService service = new WeatherService(new OpenWeatherClient(http, "unused-test-key", "https://weather.example.test"),
                cache, new WeatherResponseProcessor());
        when(cache.getFreshCache(0, 0, WeatherCacheType.CURRENT)).thenReturn(Optional.empty());
        when(http.getForObject(any(URI.class), eq(String.class))).thenReturn("""
                {"lat":0,"lon":0,"timezone":"Example","timezone_offset":3600,
                 "current":{"dt":1700000000,"temp":20,"weather":[{"id":800,"description":"clear"}]}}
                """);
        WeatherResponse response = service.getCurrent(0, 0);
        assertThat(response.getCurrent().getDt()).isEqualTo(1700000000L);
        assertThat(response.getCurrent().getTemp()).isEqualTo(20);
        ArgumentCaptor<JsonNode> json = ArgumentCaptor.forClass(JsonNode.class);
        verify(cache).saveCache(eq(0.0), eq(0.0), eq(WeatherCacheType.CURRENT), json.capture());
        when(cache.getFreshCache(0, 0, WeatherCacheType.CURRENT))
                .thenReturn(Optional.of(WeatherCache.builder().dataJson(json.getValue()).build()));
        clearInvocations(http);
        assertThat(service.getCurrent(0, 0)).isEqualTo(response);
        verifyNoInteractions(http);
    }
}
