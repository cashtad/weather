package com.example.weather.service;

import com.example.weather.api.AuthException;
import com.example.weather.dto.*;
import com.example.weather.entity.User;
import com.example.weather.repository.UserRepository;
import com.example.weather.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthResponse register(RegisterRequest request) {
        validatePasswordLength(request.getPassword());
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AuthException("Email already exists");
        }

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .createdAt(Instant.now())
                .build();

        userRepository.save(user);

        String token = jwtService.generateToken(user.getEmail());
        return new AuthResponse(token);
    }

    public AuthResponse login(LoginRequest request) {
        validatePasswordLength(request.getPassword());
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );
        String token = jwtService.generateToken(request.getEmail());
        return new AuthResponse(token);
    }

    private void validatePasswordLength(String password) {
        // BCrypt limits passwords by UTF-8 bytes, not Java character count.
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(BAD_REQUEST, "Password must not exceed 72 UTF-8 bytes");
        }
    }
}
