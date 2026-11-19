package com.example.weather.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleStatus(ResponseStatusException ex, HttpServletRequest request) {
        int status = ex.getStatusCode().value();
        return error(status, "HTTP_" + status, ex.getReason(), request);
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class})
    public ResponseEntity<ErrorResponse> handleValidation(Exception ex, HttpServletRequest request) {
        return error(400, "VALIDATION_ERROR", "Validation failed", request);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleMethodValidation(HandlerMethodValidationException ex,
                                                               HttpServletRequest request) {
        if (ex.isForReturnValue()) {
            return handleUnknown(ex, request);
        }
        return error(400, "VALIDATION_ERROR", "Validation failed", request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex,
                                                             HttpServletRequest request) {
        return error(400, "INVALID_REQUEST", "Malformed JSON or invalid field type", request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException ex,
                                                               HttpServletRequest request) {
        return error(400, "INVALID_REQUEST", "Required query parameter is missing", request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleParameterType(MethodArgumentTypeMismatchException ex,
                                                            HttpServletRequest request) {
        return error(400, "INVALID_REQUEST", "Invalid request parameter type", request);
    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<ErrorResponse> handleEmailRegistered(AuthException ex, HttpServletRequest request) {
        return error(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered", request);
    }

    @ExceptionHandler(AuthenticationServiceException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationUnavailable(AuthenticationServiceException ex,
                                                                         HttpServletRequest request) {
        log.warn("Authentication service unavailable during {}", request.getRequestURI());
        return error(503, "HTTP_503", "Authentication temporarily unavailable", request);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex, HttpServletRequest request) {
        return error(401, "UNAUTHORIZED", "Authentication failed", request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return error(403, "FORBIDDEN", "Access denied", request);
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorResponse> handleNotFound(Exception ex, HttpServletRequest request) {
        return error(404, "HTTP_404", "Resource not found", request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethod(HttpRequestMethodNotSupportedException ex,
                                                     HttpServletRequest request) {
        return error(405, "HTTP_405", "Method not allowed", request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaType(HttpMediaTypeNotSupportedException ex,
                                                        HttpServletRequest request) {
        return error(415, "HTTP_415", "Unsupported media type", request);
    }

    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<ErrorResponse> handleAccept(HttpMediaTypeNotAcceptableException ex,
                                                     HttpServletRequest request) {
        return error(406, "HTTP_406", "Not acceptable", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnknown(Exception ex, HttpServletRequest request) {
        log.error("Unexpected request failure: {} {}", request.getMethod(), request.getRequestURI(), ex);
        return error(500, "INTERNAL_ERROR", "Unexpected error", request);
    }

    private ResponseEntity<ErrorResponse> error(int status, String code, String message,
                                                HttpServletRequest request) {
        return ResponseEntity.status(status).body(
                new ErrorResponse(message, code, status, request.getRequestURI(), Instant.now()));
    }
}
