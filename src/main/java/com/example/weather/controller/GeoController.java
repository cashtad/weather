package com.example.weather.controller;

import com.example.weather.dto.GeoLocationResponse;
import com.example.weather.service.GeoService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/geo")
@RequiredArgsConstructor
public class GeoController {

    private final GeoService geoService;

    @GetMapping("/search")
    public List<GeoLocationResponse> search(@RequestParam @NotBlank @Size(max = 255) String name) {
        return geoService.search(name);
    }
}