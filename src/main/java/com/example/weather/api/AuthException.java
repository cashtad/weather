package com.example.weather.api;

public class AuthException extends RuntimeException {
    public AuthException(String message) {
        super(message);
    }
}
