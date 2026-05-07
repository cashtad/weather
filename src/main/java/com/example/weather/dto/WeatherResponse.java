package com.example.weather.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class WeatherResponse {
    private double lat;
    private double lon;
    private String timezone;

    @JsonProperty("timezone_offset")
    private int timezoneOffset;

    private Current current;
    private List<Daily> daily;
    private List<Hourly> hourly;

    @Data
    public static class Current {
        private long dt;
        private long sunrise;
        private long sunset;
        private double temp;

        @JsonProperty("feels_like")
        private double feelsLike;

        private int pressure;
        private int humidity;

        @JsonProperty("dew_point")
        private double dewPoint;

        private double uvi;
        private int clouds;
        private int visibility;

        @JsonProperty("wind_speed")
        private double windSpeed;

        @JsonProperty("wind_deg")
        private int windDeg;

        @JsonProperty("wind_gust")
        private Double windGust;   // ✅ добавь это

        private List<Weather> weather;
    }

    @Data
    public static class Hourly {
        private long dt;
        private double temp;
        @JsonProperty("feels_like")
        private double feelsLike;
        private int pressure;
        private int humidity;
        @JsonProperty("dew_point")
        private double dewPoint;
        private double uvi;
        private int clouds;
        private int visibility;
        @JsonProperty("wind_speed")
        private double windSpeed;
        @JsonProperty("wind_deg")
        private int windDeg;
        @JsonProperty("wind_gust")
        private Double windGust;
        private List<Weather> weather;
        private double pop;
        @JsonProperty("rain")
        private Rain rain;

        @Data
        public static class Rain {
            @JsonProperty("1h")
            private Double oneHour;
        }
    }

    @Data
    public static class Daily {
        private long dt;
        private long sunrise;
        private long sunset;
        private long moonrise;
        private long moonset;

        @JsonProperty("moon_phase")
        private double moonPhase;

        private String summary;
        private Temp temp;

        @JsonProperty("feels_like")
        private FeelsLike feelsLike;

        private int pressure;
        private int humidity;

        @JsonProperty("dew_point")
        private double dewPoint;

        @JsonProperty("wind_speed")
        private double windSpeed;

        @JsonProperty("wind_deg")
        private int windDeg;

        @JsonProperty("wind_gust")
        private double windGust;

        private List<Weather> weather;
        private int clouds;
        private double pop;
        private Double rain;
        private double uvi;
    }

    @Data
    public static class Temp {
        private double day;
        private double min;
        private double max;
        private double night;
        private double eve;
        private double morn;
    }

    @Data
    public static class FeelsLike {
        private double day;
        private double night;
        private double eve;
        private double morn;
    }

    @Data
    public static class Weather {
        private int id;
        private String main;
        private String description;
        private String icon;
    }
}