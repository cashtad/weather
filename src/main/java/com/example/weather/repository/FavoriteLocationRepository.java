package com.example.weather.repository;

import com.example.weather.entity.FavoriteLocation;
import com.example.weather.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FavoriteLocationRepository extends JpaRepository<FavoriteLocation, UUID> {
    List<FavoriteLocation> findAllByUser(User user);
}