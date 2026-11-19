package com.example.weather.controller;

import com.example.weather.dto.UserResponse;
import com.example.weather.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public UserResponse me() {
        return userService.getCurrentUserResponse();
    }
}
