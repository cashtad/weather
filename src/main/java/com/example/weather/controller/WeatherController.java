package com.example.weather.controller;

import com.example.weather.dto.WeatherResponse;
import com.example.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService weatherService;

    @GetMapping("/current")
    public WeatherResponse current(@RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
                                   @RequestParam @DecimalMin("-180") @DecimalMax("180") double lon) {
        return weatherService.getCurrent(lat, lon);
    }

    @GetMapping("/hourly")
    public WeatherResponse hourly(@RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
                                   @RequestParam @DecimalMin("-180") @DecimalMax("180") double lon) {
        return weatherService.getHourly(lat, lon);
    }

    @GetMapping("/daily")
    public WeatherResponse daily(@RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
                                   @RequestParam @DecimalMin("-180") @DecimalMax("180") double lon) {
        return weatherService.getDaily(lat, lon);
    }

    @GetMapping("/all")
    public WeatherResponse all(@RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
                                   @RequestParam @DecimalMin("-180") @DecimalMax("180") double lon) {
        return weatherService.getAll(lat, lon);
    }
}