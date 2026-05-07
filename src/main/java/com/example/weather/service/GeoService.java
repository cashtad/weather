package com.example.weather.service;

import com.example.weather.dto.GeoLocationResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
@RequiredArgsConstructor
public class GeoService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openweather.api-key}")
    private String apiKey;

    @Value("${openweather.base-url}")
    private String baseUrl;

    public List<GeoLocationResponse> search(String name) {
        String url = baseUrl + "/geo/1.0/direct?q=" + name + "&limit=5&appid=" + apiKey;

        try {
            String json = restTemplate.getForObject(url, String.class);
            JsonNode root = objectMapper.readTree(json);

            List<GeoLocationResponse> result = new ArrayList<>();
            for (JsonNode node : root) {
                String city = node.path("name").asText();
                String country = node.path("country").asText();
                String state = node.path("state").asText(null);
                double lat = node.path("lat").asDouble();
                double lon = node.path("lon").asDouble();
                String display = state == null || state.isBlank()
                        ? city + ", " + country
                        : city + ", " + state + ", " + country;

                result.add(new GeoLocationResponse(city, country, state, lat, lon, display));
            }
            return result;
        } catch (RestClientException | com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "OpenWeather API unavailable");
        }
    }
}