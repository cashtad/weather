package com.example.weather.controller;

import com.example.weather.dto.FavoriteLocationRequest;
import com.example.weather.dto.FavoriteLocationResponse;
import com.example.weather.service.FavoriteLocationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/favorites")
@RequiredArgsConstructor
public class FavoriteLocationController {

    private final FavoriteLocationService service;

    @GetMapping
    public List<FavoriteLocationResponse> getAll() {
        return service.getAll();
    }

    @PostMapping
    public FavoriteLocationResponse add(@Valid @RequestBody FavoriteLocationRequest request) {
        return service.add(request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}