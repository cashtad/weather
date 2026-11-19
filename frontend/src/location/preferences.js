export const LOCATION_KEY = 'weather-dashboard.location.v1';
export const PRAGUE = Object.freeze({
  name: 'Prague',
  country: 'Czechia',
  lat: 50.0755,
  lon: 14.4378,
  source: 'default',
});

export function validCoordinates(lat, lon) {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    lon >= -180 &&
    lon <= 180
  );
}

export function manualLocation(value) {
  if (
    !value ||
    !validCoordinates(value.lat, value.lon) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 255 ||
    typeof value.country !== 'string' ||
    !value.country.trim() ||
    value.country.length > 255 ||
    (value.state != null && (typeof value.state !== 'string' || value.state.length > 255))
  )
    return null;
  return {
    name: value.name.trim(),
    country: value.country.trim(),
    state: value.state?.trim() || undefined,
    lat: value.lat,
    lon: value.lon,
    source: 'manual',
  };
}

export function locationLabel(location) {
  return [...new Set([location?.name, location?.state, location?.country].filter(Boolean))].join(
    ', ',
  );
}

export function loadSavedLocation(storage) {
  try {
    const data = JSON.parse((storage ?? globalThis.localStorage).getItem(LOCATION_KEY));
    return data?.version === 1 && data.source === 'manual' ? manualLocation(data) : null;
  } catch {
    return null;
  }
}

export function saveManualLocation(location, storage) {
  if (location?.source !== 'manual') return false;
  const safe = manualLocation(location);
  if (!safe) return false;
  try {
    (storage ?? globalThis.localStorage).setItem(
      LOCATION_KEY,
      JSON.stringify({ version: 1, ...safe }),
    );
    return true;
  } catch {
    return false;
  }
}
