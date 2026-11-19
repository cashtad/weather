package com.example.weather.security;

import com.example.weather.api.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Instant;

@Component
@RequiredArgsConstructor
@Slf4j
public class SecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException exception) throws IOException {
        writeError(request, response, 401, "UNAUTHORIZED", "Authentication required or invalid credentials");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException exception) throws IOException {
        writeError(request, response, 403, "FORBIDDEN", "Access denied");
    }

    public void authenticationUnavailable(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        log.warn("Authentication data store unavailable during {}", request.getRequestURI());
        writeError(request, response, 503, "HTTP_503", "Authentication temporarily unavailable");
    }

    private void writeError(HttpServletRequest request, HttpServletResponse response,
                            int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                new ErrorResponse(message, code, status, request.getRequestURI(), Instant.now()));
    }
}
