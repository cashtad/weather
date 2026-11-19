package com.example.weather.service;

import com.example.weather.dto.WeatherResponse;
import org.springframework.stereotype.Component;

@Component
public class WeatherResponseProcessor {

    private static final int HOURLY_LIMIT = 24;

    public WeatherResponse process(WeatherResponse response) {
        if (response != null && response.getHourly() != null && response.getHourly().size() > HOURLY_LIMIT) {
            response.setHourly(response.getHourly().subList(0, HOURLY_LIMIT));
        }
        return response;
    }
}
