package com.example.weather.service;

import com.example.weather.entity.User;
import com.example.weather.dto.UserResponse;
import com.example.weather.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserResponse getCurrentUserResponse() {
        User user = getCurrentUser();
        return new UserResponse(user.getId(), user.getEmail(), user.getCreatedAt());
    }

    public User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new InsufficientAuthenticationException("Authentication required"));
    }
}
