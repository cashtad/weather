package com.example.weather.service;

import com.example.weather.dto.WeatherResponse;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WeatherResponseProcessor {

    private static final int HOURLY_LIMIT = 24;

    public WeatherResponse process(WeatherResponse response) {
        if (response == null) {
            return null;
        }

        int offset = response.getTimezoneOffset();

        applyOffsetToCurrent(response.getCurrent(), offset);
        applyOffsetToMinutely(response.getMinutely(), offset);
        applyOffsetToHourly(response.getHourly(), offset);
        applyOffsetToDaily(response.getDaily(), offset);
        applyOffsetToAlerts(response.getAlerts(), offset);

        limitHourly(response);

        return response;
    }

    private void applyOffsetToCurrent(WeatherResponse.Current current, int offset) {
        if (current == null) {
            return;
        }

        current.setDt(applyOffset(current.getDt(), offset));
        current.setSunrise(applyOffset(current.getSunrise(), offset));
        current.setSunset(applyOffset(current.getSunset(), offset));
    }

    private void applyOffsetToMinutely(List<WeatherResponse.Minutely> minutely, int offset) {
        if (minutely == null) {
            return;
        }

        for (WeatherResponse.Minutely entry : minutely) {
            entry.setDt(applyOffset(entry.getDt(), offset));
        }
    }

    private void applyOffsetToHourly(List<WeatherResponse.Hourly> hourly, int offset) {
        if (hourly == null) {
            return;
        }

        for (WeatherResponse.Hourly entry : hourly) {
            entry.setDt(applyOffset(entry.getDt(), offset));
        }
    }

    private void applyOffsetToDaily(List<WeatherResponse.Daily> daily, int offset) {
        if (daily == null) {
            return;
        }

        for (WeatherResponse.Daily entry : daily) {
            entry.setDt(applyOffset(entry.getDt(), offset));
            entry.setSunrise(applyOffset(entry.getSunrise(), offset));
            entry.setSunset(applyOffset(entry.getSunset(), offset));
            entry.setMoonrise(applyOffset(entry.getMoonrise(), offset));
            entry.setMoonset(applyOffset(entry.getMoonset(), offset));
        }
    }

    private void applyOffsetToAlerts(List<WeatherResponse.Alert> alerts, int offset) {
        if (alerts == null) {
            return;
        }

        for (WeatherResponse.Alert alert : alerts) {
            alert.setStart(applyOffset(alert.getStart(), offset));
            alert.setEnd(applyOffset(alert.getEnd(), offset));
        }
    }

    private void limitHourly(WeatherResponse response) {
        List<WeatherResponse.Hourly> hourly = response.getHourly();
        if (hourly == null || hourly.size() <= HOURLY_LIMIT) {
            return;
        }

        response.setHourly(hourly.subList(0, HOURLY_LIMIT));
    }

    private long applyOffset(long value, int offset) {
        return value + offset;
    }

    private Long applyOffset(Long value, int offset) {
        if (value == null) {
            return null;
        }
        return value + offset;
    }
}