package com.example.weather.api;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;

@Data
@AllArgsConstructor
public class ErrorResponse {
    private String message;
    private String code;
    private int status;
    private String path;
    private Instant timestamp;
}