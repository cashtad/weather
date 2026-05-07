package com.example.weather.service;

import com.example.weather.entity.WeatherCache;
import com.example.weather.entity.WeatherCacheType;
import com.example.weather.repository.WeatherCacheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CacheService {

    private static final Duration TTL = Duration.ofMinutes(10);
    private final WeatherCacheRepository weatherCacheRepository;

    public Optional<WeatherCache> getFreshCache(double lat, double lon, WeatherCacheType type) {
        return weatherCacheRepository.findTopByLatAndLonAndType(lat, lon, type)
                .filter(cache -> cache.getUpdatedAt().isAfter(Instant.now().minus(TTL)));
    }

    public WeatherCache saveCache(double lat, double lon, WeatherCacheType type, com.fasterxml.jackson.databind.JsonNode data) {
        WeatherCache cache = weatherCacheRepository.findTopByLatAndLonAndType(lat, lon, type)
                .orElse(WeatherCache.builder().lat(lat).lon(lon).type(type).build());

        cache.setDataJson(data);
        cache.setUpdatedAt(Instant.now());

        return weatherCacheRepository.save(cache);
    }
}