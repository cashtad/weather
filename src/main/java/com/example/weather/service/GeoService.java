package com.example.weather.service;

import com.example.weather.dto.GeoLocationResponse;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GeoService {

    private final OpenWeatherClient client;

    public List<GeoLocationResponse> search(String name) {
        JsonNode root = client.get("geocoding", "/geo/1.0/direct", Map.of("q", name, "limit", 5));
        if (!root.isArray()) {
            throw client.invalidPayload("geocoding");
        }
        List<GeoLocationResponse> result = new ArrayList<>();
        for (JsonNode node : root) {
            if (!node.isObject() || !text(node.get("name")) || !text(node.get("country"))
                    || !coordinate(node.get("lat"), 90) || !coordinate(node.get("lon"), 180)
                    || (node.hasNonNull("state") && !node.get("state").isTextual())) {
                throw client.invalidPayload("geocoding");
            }
            String city = node.get("name").asText();
            String country = node.get("country").asText();
            String state = node.path("state").asText(null);
            String display = state == null || state.isBlank()
                    ? city + ", " + country : city + ", " + state + ", " + country;
            result.add(new GeoLocationResponse(city, country, state,
                    node.get("lat").asDouble(), node.get("lon").asDouble(), display));
        }
        return result;
    }

    private boolean text(JsonNode node) {
        return node != null && node.isTextual() && !node.asText().isBlank();
    }

    private boolean coordinate(JsonNode node, int limit) {
        return node != null && node.isNumber() && Double.isFinite(node.asDouble())
                && Math.abs(node.asDouble()) <= limit;
    }
}
