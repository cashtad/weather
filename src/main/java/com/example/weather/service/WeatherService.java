package com.example.weather.service;

import com.example.weather.dto.WeatherResponse;
import com.example.weather.entity.WeatherCache;
import com.example.weather.entity.WeatherCacheType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
@RequiredArgsConstructor
public class WeatherService {

    private final RestTemplate restTemplate;
    private final CacheService cacheService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openweather.api-key}")
    private String apiKey;

    @Value("${openweather.base-url}")
    private String baseUrl;

    public WeatherResponse getCurrent(double lat, double lon) {
        return parse(getWeather(lat, lon, WeatherCacheType.CURRENT));
    }

    public WeatherResponse getDaily(double lat, double lon) {
        return parse(getWeather(lat, lon, WeatherCacheType.DAILY));
    }

    public WeatherResponse getHourly(double lat, double lon) {
        return parse(getWeather(lat, lon, WeatherCacheType.HOURLY));
    }

    private WeatherResponse parse(JsonNode node) {
        return objectMapper.convertValue(node, WeatherResponse.class);
    }

    private JsonNode getWeather(double lat, double lon, WeatherCacheType type) {
        JsonNode result;
        result = cacheService.getFreshCache(lat, lon, type)
                .map(WeatherCache::getDataJson)
                .orElseGet(() -> fetchAndCache(lat, lon, type));
        return result;
    }

    private JsonNode fetchAndCache(double lat, double lon, WeatherCacheType type) {
        String exclude = switch (type) {
            case CURRENT -> "minutely,hourly,daily,alerts";
            case DAILY -> "current,minutely,hourly,alerts";
            case HOURLY -> "current,minutely,daily,alerts";
        };
        String url = baseUrl + "/data/3.0/onecall?lat=" + lat + "&lon=" + lon +
                "&exclude=" + exclude + "&units=metric&lang=en&appid=" + apiKey;

        try {
            String json = restTemplate.getForObject(url, String.class);
            if (json == null || json.isBlank()) {
                throw new ResponseStatusException(BAD_GATEWAY, "Unexpected weather data");
            }

            JsonNode node = objectMapper.readTree(json);
            cacheService.saveCache(lat, lon, type, node);
            return node;
        } catch (RestClientException ex) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "OpenWeather API unavailable");
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Unexpected weather data");
        }
    }
}