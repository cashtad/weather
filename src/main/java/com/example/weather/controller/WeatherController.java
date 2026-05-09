package com.example.weather.controller;

import com.example.weather.dto.WeatherResponse;
import com.example.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
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
    public WeatherResponse current(@RequestParam double lat, @RequestParam double lon) {
        return weatherService.getCurrent(lat, lon);
    }

    @GetMapping("/hourly")
    public WeatherResponse hourly(@RequestParam double lat, @RequestParam double lon) {
        return weatherService.getHourly(lat, lon);
    }

    @GetMapping("/daily")
    public WeatherResponse daily(@RequestParam double lat, @RequestParam double lon) {
        return weatherService.getDaily(lat, lon);
    }

    @GetMapping("/all")
    public WeatherResponse all(@RequestParam double lat, @RequestParam double lon) {
        return weatherService.getAll(lat, lon);
    }
}