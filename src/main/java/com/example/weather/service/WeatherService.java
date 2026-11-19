package com.example.weather.service;

import com.example.weather.dto.WeatherResponse;
import com.example.weather.entity.WeatherCacheType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class WeatherService {

    private final OpenWeatherClient client;
    private final CacheService cacheService;
    private final WeatherResponseProcessor responseProcessor;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WeatherResponse getCurrent(double lat, double lon) {
        return getWeather(lat, lon, WeatherCacheType.CURRENT);
    }

    public WeatherResponse getDaily(double lat, double lon) {
        return getWeather(lat, lon, WeatherCacheType.DAILY);
    }

    public WeatherResponse getHourly(double lat, double lon) {
        return getWeather(lat, lon, WeatherCacheType.HOURLY);
    }

    public WeatherResponse getAll(double lat, double lon) {
        return getWeather(lat, lon, WeatherCacheType.ALL);
    }

    private WeatherResponse getWeather(double lat, double lon, WeatherCacheType type) {
        return cacheService.getFreshCache(lat, lon, type)
                .map(cache -> parse(cache.getDataJson(), type))
                .orElseGet(() -> fetchAndCache(lat, lon, type));
    }

    private WeatherResponse fetchAndCache(double lat, double lon, WeatherCacheType type) {
        String exclude = switch (type) {
            case CURRENT -> "minutely,hourly,daily,alerts";
            case DAILY -> "current,minutely,hourly,alerts";
            case HOURLY -> "current,minutely,daily,alerts";
            case ALL -> "minutely,alerts";
        };
        JsonNode raw = client.get("weather-" + type, "/data/3.0/onecall",
                Map.of("lat", lat, "lon", lon, "exclude", exclude, "units", "metric", "lang", "en"));
        WeatherResponse processed = responseProcessor.process(parse(raw, type));
        cacheService.saveCache(lat, lon, type, objectMapper.valueToTree(processed));
        return processed;
    }

    private WeatherResponse parse(JsonNode root, WeatherCacheType type) {
        if (root == null || !root.isObject() || !coordinate(root.get("lat"), 90)
                || !coordinate(root.get("lon"), 180) || !root.path("timezone").isTextual()
                || root.path("timezone").asText().isBlank() || !root.path("timezone_offset").isIntegralNumber()
                || !root.path("timezone_offset").canConvertToInt()) {
            throw client.invalidPayload("weather-" + type);
        }
        if ((type == WeatherCacheType.CURRENT || type == WeatherCacheType.ALL) && !weatherBlock(root.path("current"), false)
                || (type == WeatherCacheType.HOURLY || type == WeatherCacheType.ALL) && !forecast(root.path("hourly"), false)
                || (type == WeatherCacheType.DAILY || type == WeatherCacheType.ALL) && !forecast(root.path("daily"), true)) {
            throw client.invalidPayload("weather-" + type);
        }
        try {
            return objectMapper.convertValue(root, WeatherResponse.class);
        } catch (IllegalArgumentException ex) {
            throw client.invalidPayload("weather-" + type);
        }
    }

    private boolean forecast(JsonNode entries, boolean daily) {
        if (!entries.isArray() || entries.isEmpty()) {
            return false;
        }
        for (JsonNode entry : entries) {
            if (!weatherBlock(entry, daily)) {
                return false;
            }
        }
        return true;
    }

    private boolean weatherBlock(JsonNode node, boolean daily) {
        if (!node.isObject() || !node.path("dt").isIntegralNumber() || !node.path("dt").canConvertToLong()
                || node.path("dt").asLong() <= 0 || !node.path("weather").isArray() || node.path("weather").isEmpty()) {
            return false;
        }
        for (JsonNode weather : node.path("weather")) {
            if (!weather.isObject() || !weather.path("id").isIntegralNumber()) {
                return false;
            }
        }
        JsonNode temp = node.path("temp");
        return daily ? temp.isObject() && number(temp.path("min")) && number(temp.path("max")) : number(temp);
    }

    private boolean number(JsonNode node) {
        return node.isNumber() && Double.isFinite(node.asDouble());
    }

    private boolean coordinate(JsonNode node, int limit) {
        return node != null && number(node) && Math.abs(node.asDouble()) <= limit;
    }
}
