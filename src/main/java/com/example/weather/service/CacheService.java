package com.example.weather.service;

import com.example.weather.entity.WeatherCache;
import com.example.weather.entity.WeatherCacheType;
import com.example.weather.repository.WeatherCacheRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class CacheService {

    private final WeatherCacheRepository repository;
    private final Duration ttl;

    public CacheService(WeatherCacheRepository repository, @Value("${weather.cache-ttl:10m}") Duration ttl) {
        if (ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("Weather cache TTL must be positive");
        }
        this.repository = repository;
        this.ttl = ttl;
    }

    @Transactional(readOnly = true)
    public Optional<WeatherCache> getFreshCache(double lat, double lon, WeatherCacheType type) {
        return repository.findByLatAndLonAndType(lat, lon, type)
                .filter(cache -> cache.getUpdatedAt().isAfter(Instant.now().minus(ttl)));
    }

    @Transactional
    public void saveCache(double lat, double lon, WeatherCacheType type, JsonNode data) {
        if (data == null || !data.isObject()) {
            throw new IllegalArgumentException("Weather cache data must be a JSON object");
        }
        repository.upsert(UUID.randomUUID(), lat, lon, type.name(), data.toString(), Instant.now());
    }
}
