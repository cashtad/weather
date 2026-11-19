import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { weatherApi } from './weatherApi.js';
import { geoApi } from './geoApi.js';
import { authApi } from './authApi.js';
import { favoritesApi } from './favoritesApi.js';

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it.each(['Current', 'Hourly', 'Daily', 'All'])('uses the actual weather %s route and coordinate fields', async (kind) => {
  await weatherApi[`get${kind}`](49.1, 14.2);
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/weather/${kind.toLowerCase()}?lat=49.1&lon=14.2`);
  expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});

it('uses name for geocoding and forwards cancellation', async () => {
  const controller = new AbortController();
  await geoApi.searchCities('New York', { signal: controller.signal });
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/geo/search?name=New+York');
  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
});

it.each(['register', 'login'])('uses the actual %s payload without unrelated fields', async (operation) => {
  await authApi[operation]({ email: 'test@example.test', password: 'test-only-password', ignored: true });
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/auth/${operation}`);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'test@example.test', password: 'test-only-password' });
  expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});

it('passes an explicit token for the current user', async () => {
  await authApi.getCurrentUser('test-only-token');
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/user/me');
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-token');
});

it('lists favorites with explicit authentication', async () => {
  await favoritesApi.getAll('test-only-token');
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/favorites');
  expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-token');
});

it('uses the FavoriteLocationRequest fields', async () => {
  const favorite = { name: 'City', country: 'CZ', state: 'Region', lat: 49.1, lon: 14.2, displayName: 'City, Region, CZ' };
  await favoritesApi.add({ ...favorite, ignored: true }, 'test-only-token');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(favorite);
  expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-token');
});

it('encodes the favorite identifier as one path segment', async () => {
  await favoritesApi.remove('id/with?reserved#characters', 'test-only-token');
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/favorites/id%2Fwith%3Freserved%23characters');
  expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
});
