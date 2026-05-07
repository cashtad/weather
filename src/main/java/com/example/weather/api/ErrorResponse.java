package com.example.weather.api;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;

@Data
@AllArgsConstructor
public class ErrorResponse {
    private String error;
    private String code;
    private int status;
    private String path;
    private Instant timestamp;
}