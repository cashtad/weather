package com.example.weather.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class WeatherResponse {

    private double lat;
    private double lon;
    private String timezone;

    @JsonProperty("timezone_offset")
    private int timezoneOffset;

    private Current current;
    private List<Minutely> minutely;
    private List<Hourly> hourly;
    private List<Daily> daily;

    // ---------- Common Blocks ----------
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Weather {
        private int id;
        private String main;
        private String description;
        private String icon;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Rain {
        @JsonProperty("1h")
        private Double oneHour;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Snow {
        @JsonProperty("1h")
        private Double oneHour;
    }

    // ---------- Current ----------
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Current {
        private long dt;
        private Long sunrise;
        private Long sunset;
        private double temp;

        @JsonProperty("feels_like")
        private double feelsLike;

        private int pressure;
        private int humidity;

        @JsonProperty("dew_point")
        private double dewPoint;

        private int clouds;
        private double uvi;
        private Integer visibility;

        @JsonProperty("wind_speed")
        private double windSpeed;

        @JsonProperty("wind_gust")
        private Double windGust;

        @JsonProperty("wind_deg")
        private int windDeg;

        private Rain rain;
        private Snow snow;

        private List<Weather> weather;
    }

    // ---------- Minutely ----------
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Minutely {
        private long dt;
        private double precipitation;
    }

    // ---------- Hourly ----------
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
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
        private Integer visibility;

        @JsonProperty("wind_speed")
        private double windSpeed;

        @JsonProperty("wind_gust")
        private Double windGust;

        @JsonProperty("wind_deg")
        private int windDeg;

        private double pop;
        private Rain rain;
        private Snow snow;

        private List<Weather> weather;
    }

    // ---------- Daily ----------
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Daily {
        private long dt;
        private Long sunrise;
        private Long sunset;
        private Long moonrise;
        private Long moonset;

        @JsonProperty("moon_phase")
        private Double moonPhase;

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

        @JsonProperty("wind_gust")
        private Double windGust;

        @JsonProperty("wind_deg")
        private int windDeg;

        private int clouds;
        private double uvi;
        private double pop;

        private Double rain;
        private Double snow;

        private List<Weather> weather;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Temp {
        private double morn;
        private double day;
        private double eve;
        private double night;
        private double min;
        private double max;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FeelsLike {
        private double morn;
        private double day;
        private double eve;
        private double night;
    }
}