package com.example.weather.service;

import com.example.weather.dto.WeatherResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

class WeatherResponseProcessorTest {

    private final WeatherResponseProcessor processor = new WeatherResponseProcessor();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void allUtcTimestampsAndTimezoneMetadataRemainUnchanged() throws Exception {
        String json = """
                {"timezone":"Europe/Budapest","timezone_offset":3600,
                 "current":{"dt":1700000000,"sunrise":1699990000,"sunset":1700030000},
                 "minutely":[{"dt":1700000060}],"hourly":[{"dt":1700003600}],
                 "daily":[{"dt":1700000000,"sunrise":1699990000,"sunset":1700030000,
                           "moonrise":1700020000,"moonset":1700040000}],
                 "alerts":[{"start":1700000000,"end":1700050000}]}
                """;
        WeatherResponse response = mapper.readValue(json, WeatherResponse.class);
        var before = mapper.valueToTree(response);
        com.fasterxml.jackson.databind.JsonNode after = mapper.valueToTree(processor.process(response));
        assertThat(after).isEqualTo(before);
    }

    @Test
    void optionalFieldsAndMissingBlocksAreSafe() {
        assertThat(processor.process(null)).isNull();
        WeatherResponse response = new WeatherResponse();
        response.setTimezoneOffset(-18000);
        WeatherResponse.Current current = new WeatherResponse.Current();
        current.setDt(1700000000L);
        response.setCurrent(current);
        assertThat(processor.process(response)).isSameAs(response);
        assertThat(current.getDt()).isEqualTo(1700000000L);
        assertThat(current.getSunrise()).isNull();
        assertThat(current.getSunset()).isNull();
    }

    @Test
    void hourlyLimitStillPreservesFirst24EntriesAndTheirTimestamps() {
        WeatherResponse response = new WeatherResponse();
        response.setTimezoneOffset(3600);
        response.setHourly(new ArrayList<>());
        for (int i = 0; i < 30; i++) {
            WeatherResponse.Hourly hour = new WeatherResponse.Hourly();
            hour.setDt(1700000000L + i * 3600L);
            response.getHourly().add(hour);
        }
        processor.process(response);
        assertThat(response.getHourly()).hasSize(24);
        assertThat(response.getHourly().get(0).getDt()).isEqualTo(1700000000L);
        assertThat(response.getHourly().get(23).getDt()).isEqualTo(1700000000L + 23 * 3600L);
    }
}
