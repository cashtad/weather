// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { mountApp } from './app.js';
import { detectLocation } from './location/detectLocation.js';
import { weatherApi } from './api/weatherApi.js';
import { geoApi } from './api/geoApi.js';
import { LOCATION_KEY, PRAGUE } from './location/preferences.js';
vi.mock('./location/detectLocation.js', () => ({ detectLocation: vi.fn() }));
vi.mock('./api/weatherApi.js', () => ({ weatherApi: { getAll: vi.fn() } }));
vi.mock('./api/geoApi.js', () => ({ geoApi: { searchCities: vi.fn() } }));
const city = { name: 'Brno', country: 'CZ', lat: 49.2, lon: 16.6 };
const response = (temp) => ({
  timezone: 'Europe/Prague',
  timezone_offset: 3600,
  current: { dt: 1700000000, temp, weather: [{ description: 'clear sky' }] },
  hourly: [],
  daily: [],
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
let app, root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
  detectLocation.mockResolvedValue(PRAGUE);
  weatherApi.getAll.mockResolvedValue(response(12));
  geoApi.searchCities.mockResolvedValue([city]);
});
afterEach(() => {
  app?.destroy();
  app = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});
const flush = () => vi.advanceTimersByTimeAsync(0);
function type(value) {
  const input = root.querySelector('#city-search');
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function chooseCity(value = 'Brno') {
  type(value);
  await vi.advanceTimersByTimeAsync(300);
  root.querySelector('[role=option]').click();
  await flush();
}

it('loads one combined response for the initial location', async () => {
  app = mountApp(root);
  await flush();
  expect(weatherApi.getAll).toHaveBeenCalledTimes(1);
  expect(weatherApi.getAll).toHaveBeenCalledWith(
    PRAGUE.lat,
    PRAGUE.lon,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(root.querySelector('.current-temperature').textContent).toContain('12');
});
it('puts the search and account controls in the Weather header and keeps the weather sections in order', async () => {
  app = mountApp(root);
  await flush();
  const header = root.querySelector('header');
  expect(header.querySelector('.brand').textContent.trim()).toBe('Weather');
  expect(header.querySelector('.brand svg')).not.toBeNull();
  expect(header.querySelector('nav, .brand-secondary')).toBeNull();
  expect(header.querySelector('#city-search')).not.toBeNull();
  expect(header.querySelector('.account-sign-in').hidden).toBe(false);
  expect([...root.querySelector('main').children].map((section) => section.className)).toEqual([
    'card current-weather', 'card forecast-panel hourly-panel',
    'card forecast-panel daily-panel', 'card weather-details',
  ]);
  expect(root.querySelector('main h1').textContent).toContain('Prague');
});
it('does not block search while native location is pending', () => {
  detectLocation.mockReturnValue(new Promise(() => {}));
  app = mountApp(root);
  expect(root.querySelector('input').disabled).toBe(false);
  expect(root.querySelector('.location-button').disabled).toBe(false);
});
it('requires two trimmed characters and debounces requests for 300ms', async () => {
  app = mountApp(root);
  type(' a ');
  await vi.advanceTimersByTimeAsync(400);
  expect(geoApi.searchCities).not.toHaveBeenCalled();
  type('  Brno  ');
  await vi.advanceTimersByTimeAsync(299);
  expect(geoApi.searchCities).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(geoApi.searchCities).toHaveBeenCalledWith('Brno', expect.any(Object));
  expect(root.querySelectorAll('[role=option]')).toHaveLength(1);
});
it('coalesces rapid edits into one search', async () => {
  app = mountApp(root);
  type('Br');
  await vi.advanceTimersByTimeAsync(100);
  type('Brn');
  await vi.advanceTimersByTimeAsync(100);
  type('Brno');
  await vi.advanceTimersByTimeAsync(300);
  expect(geoApi.searchCities).toHaveBeenCalledTimes(1);
});
it('keeps the in-flight search when the same query is submitted again', async () => {
  const pending = deferred();
  geoApi.searchCities.mockReturnValue(pending.promise);
  app = mountApp(root);
  type('Brno');
  await vi.advanceTimersByTimeAsync(300);
  const { signal } = geoApi.searchCities.mock.calls[0][1];
  root.querySelector('.city-search').dispatchEvent(new Event('submit', { cancelable: true }));
  expect(geoApi.searchCities).toHaveBeenCalledTimes(1);
  expect(signal.aborted).toBe(false);
  pending.resolve([city]);
  await flush();
  expect(root.querySelector('[role=option]').textContent).toContain('Brno');
});
it('shows searching and no-results states', async () => {
  geoApi.searchCities.mockResolvedValue([]);
  app = mountApp(root);
  type('Unknown');
  expect(root.querySelector('#search-help').textContent).toBe('Searching...');
  await vi.advanceTimersByTimeAsync(300);
  expect(root.querySelector('#search-help').textContent).toBe('No matching cities found.');
});
it('shows a safe search error without breaking existing weather', async () => {
  geoApi.searchCities.mockRejectedValue(new Error('private diagnostics'));
  app = mountApp(root);
  await flush();
  type('City');
  await vi.advanceTimersByTimeAsync(300);
  expect(root.querySelector('#search-help').textContent).toContain('Unable to search');
  expect(root.textContent).not.toContain('private diagnostics');
  expect(root.querySelector('.current-temperature')).not.toBeNull();
});
it('cancels stale searches and ignores their late results', async () => {
  const first = deferred();
  geoApi.searchCities
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce([{ ...city, name: 'New city' }]);
  app = mountApp(root);
  type('Old');
  await vi.advanceTimersByTimeAsync(300);
  const signal = geoApi.searchCities.mock.calls[0][1].signal;
  type('New');
  expect(signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(300);
  first.resolve([{ ...city, name: 'Old city' }]);
  await flush();
  expect(root.querySelector('[role=option]').textContent).toContain('New city');
});
it('selects results with arrow keys and Enter and persists only the city', async () => {
  app = mountApp(root);
  type('Brno');
  await vi.advanceTimersByTimeAsync(300);
  const input = root.querySelector('input');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(input.getAttribute('aria-activedescendant')).toBe('city-option-0');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await flush();
  expect(root.querySelector('.location-name').textContent).toBe('Brno, CZ');
  expect(JSON.parse(localStorage.getItem(LOCATION_KEY))).toMatchObject({
    ...city,
    source: 'manual',
    version: 1,
  });
  expect(input.getAttribute('aria-expanded')).toBe('false');
});
it('supports ArrowUp and Escape and does not reopen an escaped pending search', async () => {
  const pending = deferred();
  geoApi.searchCities.mockReturnValueOnce(pending.promise);
  app = mountApp(root);
  type('Brno');
  await vi.advanceTimersByTimeAsync(300);
  const input = root.querySelector('input');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  pending.resolve([city]);
  await flush();
  expect(root.querySelector('[role=listbox]').hidden).toBe(true);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(input.getAttribute('aria-activedescendant')).toBe('city-option-0');
});
it('manual selection overrides a delayed automatic location callback', async () => {
  const pending = deferred();
  detectLocation.mockReturnValue(pending.promise);
  app = mountApp(root);
  await chooseCity();
  expect(detectLocation.mock.calls[0][0].signal.aborted).toBe(true);
  pending.resolve({ ...PRAGUE, source: 'browser', name: 'Current location' });
  await flush();
  expect(root.querySelector('.location-name').textContent).toBe('Brno, CZ');
  expect(weatherApi.getAll).toHaveBeenCalledTimes(1);
});
it('new location detection invalidates the previous request', async () => {
  const first = deferred(),
    second = deferred();
  detectLocation.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  app = mountApp(root);
  root.querySelector('.location-button').click();
  second.resolve({ ...city, source: 'ip' });
  await flush();
  first.resolve(PRAGUE);
  await flush();
  expect(root.querySelector('.location-name').textContent).toBe('Brno, CZ');
  expect(root.querySelector('.location-status').textContent).toContain('approximate');
});
it('prevents duplicate geolocation requests while keeping manual search available', async () => {
  const pending = deferred();
  detectLocation.mockResolvedValueOnce(PRAGUE).mockReturnValueOnce(pending.promise);
  app = mountApp(root);
  await flush();
  const locate = root.querySelector('.location-button');
  expect(locate.getAttribute('aria-label')).toBe('Use my location');
  locate.click();
  locate.click();
  expect(locate.getAttribute('aria-disabled')).toBe('true');
  expect(detectLocation).toHaveBeenCalledTimes(2);
  expect(detectLocation.mock.calls[1][0].useSaved).toBe(false);
  await chooseCity();
  expect(locate.getAttribute('aria-disabled')).toBe('false');
  pending.resolve(PRAGUE);
  await flush();
  expect(root.querySelector('.location-name').textContent).toContain('Brno');
});
it('never persists device coordinates or the default fallback', async () => {
  detectLocation.mockResolvedValue({ ...PRAGUE, source: 'browser', name: 'Current location' });
  app = mountApp(root);
  await flush();
  expect(localStorage.getItem(LOCATION_KEY)).toBeNull();
  expect(root.querySelector('.location-name').textContent).toContain('Current location');
});
it('keeps fallback Prague out of storage', async () => {
  app = mountApp(root);
  await flush();
  expect(localStorage.getItem(LOCATION_KEY)).toBeNull();
  expect(root.querySelector('.location-status').textContent).toContain('default');
});
it.each([502, 503, 0])(
  'shows weather error %i and retries without detecting location again',
  async (status) => {
    weatherApi.getAll.mockRejectedValueOnce({ status }).mockResolvedValueOnce(response(18));
    app = mountApp(root);
    await flush();
    expect(root.querySelector('.retry-button')).not.toBeNull();
    root.querySelector('.retry-button').click();
    await flush();
    expect(root.querySelector('.current-temperature').textContent).toContain('18');
    expect(detectLocation).toHaveBeenCalledTimes(1);
    expect(weatherApi.getAll).toHaveBeenCalledTimes(2);
  },
);
it('rejects malformed success data and provides retry', async () => {
  weatherApi.getAll.mockResolvedValue({});
  app = mountApp(root);
  await flush();
  expect(root.querySelector('.retry-button')).not.toBeNull();
});
it('does not render city A weather under city B during a switch', async () => {
  const first = deferred(),
    second = deferred();
  weatherApi.getAll.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  app = mountApp(root);
  await flush();
  expect(root.querySelector('.weather-message').textContent).toContain('Loading');
  const signal = weatherApi.getAll.mock.calls[0][2].signal;
  await chooseCity();
  expect(signal.aborted).toBe(true);
  second.resolve(response(20));
  await flush();
  first.resolve(response(99));
  await flush();
  expect(root.querySelector('.location-name').textContent).toBe('Brno, CZ');
  expect(root.querySelector('.current-temperature').textContent).toContain('20');
  expect(root.querySelector('.current-temperature').textContent).not.toContain('99');
});
it('renders untrusted city labels as text', async () => {
  geoApi.searchCities.mockResolvedValue([{ ...city, name: '<img src=x onerror=bad()>' }]);
  app = mountApp(root);
  type('City');
  await vi.advanceTimersByTimeAsync(300);
  expect(root.querySelector('[role=option] img')).toBeNull();
});
it('cleans up listeners and pending requests on destroy', async () => {
  const pending = deferred();
  weatherApi.getAll.mockReturnValue(pending.promise);
  app = mountApp(root);
  await flush();
  app.destroy();
  type('Brno');
  await vi.advanceTimersByTimeAsync(300);
  expect(geoApi.searchCities).not.toHaveBeenCalled();
  expect(weatherApi.getAll.mock.calls[0][2].signal.aborted).toBe(true);
  pending.resolve(response(99));
  await flush();
  expect(root.querySelector('.current-temperature')).toBeNull();
});
