import { describe, it, expect, vi } from 'vitest';
import {
  LOCATION_KEY,
  PRAGUE,
  validCoordinates,
  manualLocation,
  loadSavedLocation,
  saveManualLocation,
} from './preferences.js';
const city = {
  name: 'Prague',
  country: 'CZ',
  state: 'Region',
  lat: 50.0755,
  lon: 14.4378,
  source: 'manual',
};

it.each([
  [0, 0],
  [-90, -180],
  [90, 180],
])('accepts boundary coordinates %s, %s', (lat, lon) =>
  expect(validCoordinates(lat, lon)).toBe(true),
);
it.each([
  [null, 0],
  [undefined, 0],
  ['50', 14],
  [NaN, 0],
  [Infinity, 0],
  [91, 0],
  [0, -181],
])('rejects invalid coordinates %s, %s', (lat, lon) =>
  expect(validCoordinates(lat, lon)).toBe(false),
);
it('loads a validated manual preference and strips unnecessary data', () => {
  const storage = {
    getItem: () => JSON.stringify({ version: 1, ...city, ip: 'private', token: 'not-to-retain' }),
  };
  expect(loadSavedLocation(storage)).toEqual(city);
});
it.each([
  'broken',
  '{}',
  'null',
  JSON.stringify({ version: 0, ...city }),
  JSON.stringify({ version: 1, ...city, lat: 999 }),
  JSON.stringify({ version: 1, ...city, source: 'browser' }),
])('ignores obsolete or malformed storage', (value) => {
  expect(loadSavedLocation({ getItem: () => value })).toBeNull();
});
it('survives disabled storage', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  expect(loadSavedLocation(storage)).toBeNull();
  expect(saveManualLocation(city, storage)).toBe(false);
});
it('stores only necessary manual location fields', () => {
  const storage = { setItem: vi.fn() };
  saveManualLocation({ ...city, ip: 'private', weather: {} }, storage);
  expect(storage.setItem).toHaveBeenCalledWith(
    LOCATION_KEY,
    JSON.stringify({ version: 1, ...city }),
  );
});
it.each(['browser', 'ip', 'default'])('never persists automatic %s coordinates', (source) => {
  const storage = { setItem: vi.fn() };
  expect(saveManualLocation({ ...city, source }, storage)).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
});
it('rejects missing names and keeps Prague a nonmanual fallback', () => {
  expect(manualLocation({ ...city, name: '' })).toBeNull();
  expect(PRAGUE.source).toBe('default');
});
