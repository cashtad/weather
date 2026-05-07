package com.example.weather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FavoriteLocationRequest {
    @NotBlank
    private String name;

    private String country;
    private String state;

    @NotNull
    private Double lat;

    @NotNull
    private Double lon;

    @NotBlank
    private String displayName;
}