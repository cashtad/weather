package com.example.weather.service;

import com.example.weather.entity.WeatherCache;
import com.example.weather.entity.WeatherCacheType;
import com.example.weather.repository.WeatherCacheRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CacheServiceTest {
    private final WeatherCacheRepository repository = mock(WeatherCacheRepository.class);
    private final CacheService cache = new CacheService(repository, Duration.ofMinutes(10));

    @Test
    void freshCacheIsReturned() {
        WeatherCache row = WeatherCache.builder().updatedAt(Instant.now().minusSeconds(30)).build();
        when(repository.findByLatAndLonAndType(0, 0, WeatherCacheType.CURRENT)).thenReturn(Optional.of(row));
        assertThat(cache.getFreshCache(0, 0, WeatherCacheType.CURRENT)).contains(row);
    }

    @Test
    void expiredAndMissingEntriesAreMisses() {
        when(repository.findByLatAndLonAndType(0, 0, WeatherCacheType.CURRENT))
                .thenReturn(Optional.of(WeatherCache.builder().updatedAt(Instant.now().minusSeconds(3600)).build()), Optional.empty());
        assertThat(cache.getFreshCache(0, 0, WeatherCacheType.CURRENT)).isEmpty();
        assertThat(cache.getFreshCache(0, 0, WeatherCacheType.CURRENT)).isEmpty();
    }

    @Test
    void validObjectIsWrittenAtomicallyWithoutLookup() {
        var data = new ObjectMapper().createObjectNode().put("marker", 1);
        cache.saveCache(0, 0, WeatherCacheType.CURRENT, data);
        verify(repository).upsert(any(), eq(0.0), eq(0.0), eq("CURRENT"), eq(data.toString()), any());
        verifyNoMoreInteractions(repository);
    }

    @Test
    void invalidCacheDataAndTtlAreRejected() {
        assertThatIllegalArgumentException().isThrownBy(() -> cache.saveCache(0, 0, WeatherCacheType.CURRENT, null));
        assertThatIllegalArgumentException().isThrownBy(() -> new CacheService(repository, Duration.ZERO));
        verifyNoInteractions(repository);
    }
}
