package com.example.weather.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class FavoriteLocationResponse {
    private UUID id;
    private String name;
    private String country;
    private String state;
    private double lat;
    private double lon;
    private String displayName;
}