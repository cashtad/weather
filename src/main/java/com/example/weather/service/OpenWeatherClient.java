package com.example.weather.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Slf4j
@Component
public class OpenWeatherClient {

    private final RestTemplate restTemplate;
    private final String apiKey;
    private final String baseUrl;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    public OpenWeatherClient(RestTemplate restTemplate,
                             @Value("${openweather.api-key}") String apiKey,
                             @Value("${openweather.base-url}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    public JsonNode get(String operation, String path, Map<String, ?> parameters) {
        Map<String, Object> variables = new LinkedHashMap<>(parameters);
        variables.put("appid", apiKey);
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl).path(path);
        variables.keySet().forEach(key -> builder.queryParam(key, "{" + key + "}"));
        // URI variables are strictly encoded, including reserved characters in a city name.
        URI uri = builder.encode().buildAndExpand(variables).toUri();
        String json;
        try {
            json = restTemplate.getForObject(uri, String.class);
        } catch (ResourceAccessException ex) {
            boolean timeout = false;
            for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
                if (cause instanceof SocketTimeoutException || cause instanceof HttpTimeoutException) {
                    timeout = true;
                    break;
                }
            }
            log.warn("OpenWeather operation={} category={}", operation, timeout ? "timeout" : "connection");
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "OpenWeather API unavailable");
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            String category = status == 429 ? "rate-limit" : status >= 500 ? "server"
                    : status == 401 || status == 403 ? "authentication" : "http";
            // Never log the exception: its message can contain the URL, key and provider body.
            log.warn("OpenWeather operation={} category={} upstreamStatus={}", operation, category, status);
            throw new ResponseStatusException(status == 429 || status >= 500 ? SERVICE_UNAVAILABLE : BAD_GATEWAY,
                    status == 429 || status >= 500 ? "OpenWeather API unavailable" : "OpenWeather request failed");
        } catch (RestClientException ex) {
            log.warn("OpenWeather operation={} category=protocol", operation);
            throw new ResponseStatusException(BAD_GATEWAY, "Unexpected OpenWeather response");
        }
        if (json == null || json.isBlank()) {
            throw invalidPayload(operation);
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node == null || node.isNull()) {
                throw invalidPayload(operation);
            }
            return node;
        } catch (JsonProcessingException ex) {
            throw invalidPayload(operation);
        }
    }

    public ResponseStatusException invalidPayload(String operation) {
        log.warn("OpenWeather operation={} category=invalid-payload", operation);
        return new ResponseStatusException(BAD_GATEWAY, "Unexpected OpenWeather data");
    }
}
