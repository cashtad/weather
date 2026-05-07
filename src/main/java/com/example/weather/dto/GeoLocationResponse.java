package com.example.weather.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class GeoLocationResponse {
    private String name;
    private String country;
    private String state;
    private double lat;
    private double lon;
    private String displayName;
}