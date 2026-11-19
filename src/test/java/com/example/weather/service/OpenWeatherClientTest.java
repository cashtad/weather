package com.example.weather.service;

import com.example.weather.api.GlobalExceptionHandler;
import com.example.weather.controller.GeoController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.anything;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(OutputCaptureExtension.class)
class OpenWeatherClientTest {
    private static final String KEY = "test-key-not-a-production-secret";
    private MockRestServiceServer server;
    private GeoService geo;

    @BeforeEach
    void setUp() {
        RestTemplate http = new RestTemplate();
        server = MockRestServiceServer.bindTo(http).build();
        geo = new GeoService(new OpenWeatherClient(http, KEY, "https://weather.example.test"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"New York", "\u010cesk\u00e9 Bud\u011bjovice", "\u6771\u4eac", "A&B#C?limit=99+% /"})
    void encodesSearchAsOneQueryParameter(String name) {
        server.expect(request -> {
            var query = UriComponentsBuilder.fromUri(request.getURI()).build(true).getQueryParams();
            assertThat(query).hasSize(3);
            assertThat(UriUtils.decode(query.getFirst("q"), StandardCharsets.UTF_8)).isEqualTo(name);
            assertThat(query.getFirst("limit")).isEqualTo("5");
            assertThat(request.getURI().getFragment()).isNull();
        }).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        assertThat(geo.search(name)).isEmpty();
        server.verify();
    }

    @Test
    void mapsSuccessfulGeocodingWithOptionalState() {
        server.expect(anything()).andRespond(withSuccess("""
                [{"name":"City","country":"CZ","lat":49.1,"lon":14.2,"state":"Region"},
                 {"name":"Other","country":"HU","lat":47,"lon":19}]
                """, MediaType.APPLICATION_JSON));
        var result = geo.search("City");
        assertThat(result).hasSize(2);
        assertThat(result.get(0).getDisplayName()).isEqualTo("City, Region, CZ");
        assertThat(result.get(1).getState()).isNull();
        server.verify();
    }

    @ParameterizedTest
    @CsvSource({"429,503", "500,503", "503,503", "401,502", "403,502", "404,502"})
    void categorizesProviderHttpErrorsWithoutLeaks(int upstream, int expected, CapturedOutput output) {
        server.expect(anything()).andRespond(withStatus(HttpStatus.valueOf(upstream))
                .body("private-provider-response " + KEY).contentType(MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> geo.search("City")).isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
            assertThat(ex.getStatusCode().value()).isEqualTo(expected);
            assertThat(ex.getReason()).doesNotContain(KEY, "private-provider-response");
            assertThat(ex.getCause()).isNull();
        });
        assertThat(output.getAll()).contains("operation=geocoding", "upstreamStatus=" + upstream)
                .doesNotContain(KEY, "private-provider-response", "appid=");
        server.verify();
    }

    @Test
    void connectionFailureIs503AndDoesNotLeakExceptionUrl(CapturedOutput output) {
        server.expect(anything()).andRespond(request -> { throw new ConnectException("appid=" + KEY); });
        assertUnavailable();
        assertThat(output.getAll()).contains("category=connection").doesNotContain(KEY, "appid=");
    }

    @Test
    void timeoutIs503WithoutRetries(CapturedOutput output) {
        server.expect(anything()).andRespond(request -> { throw new SocketTimeoutException("appid=" + KEY); });
        assertUnavailable();
        assertThat(output.getAll()).contains("category=timeout").doesNotContain(KEY, "appid=");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "null", "{", "[] {}", "{}", "[{}]",
            "[{\"name\":\"City\",\"country\":\"CZ\",\"lat\":\"bad\",\"lon\":14}]",
            "[{\"name\":\"City\",\"country\":\"CZ\",\"lat\":999,\"lon\":14}]"})
    void rejectsInvalidGeocodingBodies(String body) {
        server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> geo.search("City")).isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(502));
        server.verify();
    }

    @Test
    void apiErrorBodyRetainsContractAndHidesProviderDetails() throws Exception {
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED).body(KEY));
        var mvc = MockMvcBuilders.standaloneSetup(new GeoController(geo))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        var response = mvc.perform(get("/api/v1/geo/search").param("name", "City"))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.status").value(502))
                .andExpect(jsonPath("$.code").value("HTTP_502"))
                .andExpect(jsonPath("$.path").value("/api/v1/geo/search"))
                .andExpect(jsonPath("$.timestamp").isString()).andReturn().getResponse();
        assertThat(response.getContentAsString()).doesNotContain(KEY, "appid", "trace");
        server.verify();
    }

    private void assertUnavailable() {
        assertThatThrownBy(() -> geo.search("City")).isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(503));
        server.verify();
    }
}
