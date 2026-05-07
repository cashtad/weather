package com.example.weather.service;

import com.example.weather.dto.FavoriteLocationRequest;
import com.example.weather.dto.FavoriteLocationResponse;
import com.example.weather.entity.FavoriteLocation;
import com.example.weather.entity.User;
import com.example.weather.repository.FavoriteLocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FavoriteLocationService {

    private final FavoriteLocationRepository repository;
    private final UserService userService;

    public List<FavoriteLocationResponse> getAll() {
        User user = userService.getCurrentUser();
        return repository.findAllByUser(user).stream()
                .map(this::toResponse)
                .toList();
    }

    public FavoriteLocationResponse add(FavoriteLocationRequest request) {
        User user = userService.getCurrentUser();

        FavoriteLocation entity = FavoriteLocation.builder()
                .user(user)
                .name(request.getName())
                .country(request.getCountry())
                .state(request.getState())
                .lat(request.getLat())
                .lon(request.getLon())
                .displayName(request.getDisplayName())
                .createdAt(Instant.now())
                .build();

        return toResponse(repository.save(entity));
    }

    public void delete(UUID id) {
        User user = userService.getCurrentUser();
        FavoriteLocation location = repository.findById(id)
                .filter(l -> l.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new RuntimeException("Location not found"));

        repository.delete(location);
    }

    private FavoriteLocationResponse toResponse(FavoriteLocation entity) {
        return new FavoriteLocationResponse(
                entity.getId(),
                entity.getName(),
                entity.getCountry(),
                entity.getState(),
                entity.getLat(),
                entity.getLon(),
                entity.getDisplayName()
        );
    }
}