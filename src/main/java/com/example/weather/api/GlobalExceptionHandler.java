package com.example.weather.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleStatus(ResponseStatusException ex, HttpServletRequest req) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        return ResponseEntity.status(status).body(
                new ErrorResponse(
                        ex.getReason(),
                        "HTTP_" + status.value(),
                        status.value(),
                        req.getRequestURI(),
                        Instant.now()
                )
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        return ResponseEntity.badRequest().body(
                new ErrorResponse(
                        "Validation failed",
                        "VALIDATION_ERROR",
                        400,
                        req.getRequestURI(),
                        Instant.now()
                )
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraint(ConstraintViolationException ex, HttpServletRequest req) {
        return ResponseEntity.badRequest().body(
                new ErrorResponse(
                        "Validation failed",
                        "VALIDATION_ERROR",
                        400,
                        req.getRequestURI(),
                        Instant.now()
                )
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnknown(Exception ex, HttpServletRequest req) {
        return ResponseEntity.status(500).body(
                new ErrorResponse(
                        "Unexpected error",
                        "INTERNAL_ERROR",
                        500,
                        req.getRequestURI(),
                        Instant.now()
                )
        );
    }
}