package com.example.weather.repository;

import com.example.weather.entity.WeatherCache;
import com.example.weather.entity.WeatherCacheType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WeatherCacheRepository extends JpaRepository<WeatherCache, UUID> {
    Optional<WeatherCache> findTopByLatAndLonAndType(double lat, double lon, WeatherCacheType type);
}