-- Keep the newest cache row; the greatest UUID breaks equal-timestamp ties deterministically.
LOCK TABLE weather_cache IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
    SELECT id, row_number() OVER (
        PARTITION BY lat, lon, type ORDER BY updated_at DESC, id DESC
    ) AS position
    FROM weather_cache
)
DELETE FROM weather_cache AS cache
USING ranked
WHERE cache.id = ranked.id AND ranked.position > 1;

ALTER TABLE weather_cache
    ADD CONSTRAINT uq_weather_cache_coords_type UNIQUE (lat, lon, type);

DROP INDEX idx_weather_cache_coords_type;
