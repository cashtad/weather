package com.example.weather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FavoriteLocationRequest {
    @NotBlank
    @Size(max = 255)
    private String name;

    @Size(max = 10)
    private String country;
    @Size(max = 255)
    private String state;

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    private Double lat;

    @NotNull
    @DecimalMin("-180")
    @DecimalMax("180")
    private Double lon;

    @NotBlank
    @Size(max = 255)
    private String displayName;
}