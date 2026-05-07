package com.example.weather.controller;

import com.example.weather.dto.WeatherResponse;
import com.example.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

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
}