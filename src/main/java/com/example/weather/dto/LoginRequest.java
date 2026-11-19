package com.example.weather.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class LoginRequest {
    @Email
    @Size(max = 255)
    @NotBlank
    private String email;

    @NotBlank
    @Size(max = 72)
    private String password;
}