package com.example.weather.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "weather_cache")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherCache {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lon;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WeatherCacheType type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode dataJson;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}