// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from 'vitest';
import { createCurrentWeather } from './CurrentWeather.js';
import { createForecastPanel } from './ForecastPanel.js';
import { createWeatherIcon } from './WeatherIcon.js';
import { createWeatherDetails } from './WeatherDetails.js';
const current = {
  dt: 1700000000,
  temp: 12,
  feels_like: 10,
  humidity: 75,
  wind_speed: 2.5,
  pressure: 1012,
  weather: [{ description: 'light rain', icon: '10d' }],
};
afterEach(() => document.body.replaceChildren());
it('shows the current temperature, description and feels-like value without secondary metrics', () => {
  const view = createCurrentWeather(vi.fn());
  view.update({ location: { name: 'City' }, data: { current, timezone: 'Europe/Prague' } });
  document.body.append(view.element);
  const summary = view.element.querySelector('.weather-summary');
  expect([...summary.children].map((child) => child.textContent)).toEqual([
    '12°C', 'Light rain', 'Feels like 10°C',
  ]);
  expect(summary.nextElementSibling.className).toBe('weather-icon');
  expect(view.element.querySelector('.weather-measurements')).toBeNull();
  expect(view.element.textContent).not.toMatch(/humidity|wind|pressure|sunrise|sunset|UV index|visibility|cloud coverage/i);
});
it('keeps the heart and saved state next to the active city', () => {
  const save = vi.fn();
  const view = createCurrentWeather(vi.fn(), save);
  view.updateSave({ visible: true });
  const button = view.element.querySelector('.save-favorite');
  expect(button.hidden).toBe(false);
  expect(button.parentElement.querySelector('h1')).not.toBeNull();
  expect(button.querySelector('svg')).not.toBeNull();
  expect(button.querySelector('.visually-hidden').textContent).toBe('Save city');
  button.click();
  expect(save).toHaveBeenCalledOnce();
  view.updateSave({ visible: true, disabled: true, saved: true, label: 'Saved' });
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(button.textContent).toBe('Saved');
  expect(button.disabled).toBe(true);
});
it('hides the heart for guests and announces the pending save', () => {
  const view = createCurrentWeather(vi.fn(), vi.fn());
  const button = view.element.querySelector('.save-favorite');
  expect(button.hidden).toBe(true);
  view.updateSave({ visible: true, disabled: true, label: 'Saving city...' });
  expect(button.disabled).toBe(true);
  expect(view.element.querySelector('#save-note').textContent).toBe('Saving city...');
  view.updateSave({ visible: false });
  expect(button.hidden).toBe(true);
  expect(view.element.querySelector('#save-note').textContent).toBe('');
});
it('shows the full location and its daylight-saving time without an IANA label', () => {
  const view = createCurrentWeather(vi.fn());
  view.update({
    location: { name: 'Prague', country: 'CZ' },
    data: {
      timezone: 'Europe/Prague',
      timezone_offset: 3600,
      current: { dt: Date.parse('2026-07-02T22:05:00Z') / 1000 },
    },
  });
  expect(view.element.querySelector('h1').textContent).toBe('Prague, CZ');
  const date = view.element.querySelector('.local-date');
  expect(date.previousElementSibling).toBe(view.element.querySelector('h1'));
  expect(date.querySelector('.local-date-text').textContent).toBe('Friday 3 Jul · 00:05');
  expect(date.querySelector('.local-date-utc').hidden).toBe(true);
  expect(view.element.textContent).not.toContain('Europe/Prague');
});
it.each([undefined, 'Invalid/Zone'])('labels the date as UTC when the location zone is %s', (timezone) => {
  const view = createCurrentWeather(vi.fn());
  view.update({ data: { current, timezone } });
  expect(view.element.querySelector('.local-date-text').textContent).toBe('Tuesday 14 Nov · 22:13');
  const label = view.element.querySelector('.local-date-utc');
  expect(label.hidden).toBe(false);
  expect(label.textContent).toBe('UTC');
});
it('keeps zero and negative temperatures and handles a missing description', () => {
  const view = createCurrentWeather(vi.fn());
  view.update({ data: { current: { temp: 0, feels_like: -6 } } });
  expect(view.element.querySelector('.current-temperature').textContent).toBe('0°C');
  expect(view.element.querySelector('.feels-like').textContent).toBe('Feels like -6°C');
  expect(view.element.querySelector('.weather-description').textContent).toBe('Conditions unavailable');
});
it('keeps the current icon decorative and falls back within the same slot on image failure', () => {
  const view = createCurrentWeather(vi.fn());
  view.update({ data: { current } });
  const icon = view.element.querySelector('.current-details > .weather-icon');
  const image = icon.querySelector('img');
  expect(icon.getAttribute('aria-hidden')).toBe('true');
  expect(image.src).toBe('https://openweathermap.org/img/wn/10d@4x.png');
  image.dispatchEvent(new Event('error'));
  expect(image.src).toBe('https://openweathermap.org/img/wn/10d@2x.png');
  image.dispatchEvent(new Event('load'));
  expect(image.hidden).toBe(false);
  image.dispatchEvent(new Event('error'));
  expect(icon.querySelector('img')).toBeNull();
  expect(icon.querySelector('.weather-icon-fallback').hidden).toBe(false);
});
it('renders missing fields without fake zero values', () => {
  const view = createCurrentWeather(vi.fn());
  view.update({ data: { current: {} } });
  expect(view.element.textContent).not.toMatch(/undefined|null|NaN|object Object/);
  expect(view.element.querySelector('.local-date').hidden).toBe(true);
  expect(view.element.querySelector('.current-temperature').textContent).toBe('—');
  expect(view.element.querySelector('.feels-like').textContent).toBe('Feels like —');
});
it('renders loading and a working retry action', () => {
  const retry = vi.fn();
  const view = createCurrentWeather(retry);
  view.update({ data: { current } });
  expect(view.element.querySelector('.local-date').hidden).toBe(false);
  view.update({ loading: true });
  expect(view.element.textContent).toContain('Loading weather');
  expect(view.element.querySelector('.current-temperature')).toBeNull();
  expect(view.element.querySelector('.local-date').hidden).toBe(true);
  expect(view.element.querySelector('.current-details').getAttribute('aria-busy')).toBe('true');
  view.update({ error: 'Unavailable' });
  view.element.querySelector('button').click();
  expect(retry).toHaveBeenCalledTimes(1);
});
it('keeps keyboard users in the current card when Retry disappears', () => {
  const retry = vi.fn(() => view.update({ loading: true }));
  const view = createCurrentWeather(retry);
  document.body.append(view.element);
  view.update({ error: 'Unavailable' });
  const button = view.element.querySelector('.retry-button');
  button.focus();
  button.click();
  expect(document.activeElement).toBe(view.element.querySelector('.location-name'));
});
it('renders hourly data and precipitation with keyboard scrolling', () => {
  const view = createForecastPanel('hourly');
  view.update({ data: { timezone: 'UTC', hourly: [
    { ...current, pop: 0.2 },
    { ...current, dt: current.dt + 3600 },
    { ...current, dt: current.dt + 7200 },
  ] } });
  const scroll = view.element.querySelector('.hourly-items');
  scroll.scrollBy = vi.fn();
  scroll.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(scroll.scrollBy).toHaveBeenCalledWith({ left: 180, behavior: 'auto' });
  expect(view.element.textContent).toContain('Precipitation 20%');
  expect(scroll.tabIndex).toBe(0);
  expect([...scroll.querySelectorAll('.forecast-time')].map((hour) => hour.textContent)).toEqual([
    '22:13', '23:13', '00:13',
  ]);
});
it('renders actual daily min and max without generating extra days', () => {
  const view = createForecastPanel('daily');
  view.update({ data: { timezone: 'UTC', daily: [{ ...current, temp: { min: 5, max: 12 } }] } });
  expect(view.element.querySelectorAll('.daily-item')).toHaveLength(1);
  expect([...view.element.querySelectorAll('li dl dt')].map((label) => label.textContent)).toEqual(['Min', 'Max']);
  expect([...view.element.querySelectorAll('li dl dd')].map((value) => value.textContent)).toEqual(['5°C', '12°C']);
});
it('renders one row per available local day with day/night values, including zero and partial data', () => {
  const view = createForecastPanel('daily');
  view.update({ data: {
    timezone: 'Europe/Prague',
    daily: [
      { dt: Date.parse('2026-01-05T23:30:00Z') / 1000, temp: { day: 5, night: 0, min: -2, max: 8 } },
      { dt: Date.parse('2026-01-06T23:30:00Z') / 1000, temp: { night: -4 } },
    ],
  } });
  const rows = [...view.element.querySelectorAll('ul.daily-items > li')];
  expect(rows.map((row) => row.querySelector('.forecast-time').textContent)).toEqual(['Tue 6 Jan', 'Wed 7 Jan']);
  expect(rows[0].querySelector('dl').textContent).toBe('Day5°CNight0°C');
  expect(rows[1].querySelector('dl').textContent).toBe('Day—Night-4°C');
});
it.each(['hourly', 'daily'])('shows an empty state for missing %s', (kind) => {
  const view = createForecastPanel(kind);
  view.update({ data: { current } });
  expect(view.element.textContent).toContain('No ' + kind + ' forecast available');
});

function detailsValues(view) {
  return Object.fromEntries([...view.element.querySelectorAll('dl > div')].map((row) => [
    row.querySelector('dt').textContent,
    row.querySelector('dd').textContent,
  ]));
}

it('displays the eight supported metrics with units and local sunrise and sunset', () => {
  const view = createWeatherDetails();
  view.update({ data: { timezone: 'Europe/Prague', current: {
    ...current,
    sunrise: Date.parse('2026-07-02T03:00:00Z') / 1000,
    sunset: Date.parse('2026-07-02T19:15:00Z') / 1000,
    uvi: 4.3, visibility: 10000, clouds: 80,
  } } });
  expect(detailsValues(view)).toEqual({
    Humidity: '75%', Wind: '2.5 m/s', Pressure: '1012 hPa',
    Sunrise: '05:00', Sunset: '21:15', 'UV index': '4.3', Visibility: '10 km', 'Cloud coverage': '80%',
  });
});
it('uses a daily sun value only for the matching local date and prefers available current data', () => {
  const view = createWeatherDetails();
  const unix = (iso) => Date.parse(iso) / 1000;
  view.update({ data: {
    timezone: 'America/New_York',
    current: { dt: unix('2026-07-01T01:00:00Z'), sunset: unix('2026-07-01T00:15:00Z') },
    daily: [
      { dt: unix('2026-07-01T16:00:00Z'), sunrise: unix('2026-07-01T10:00:00Z') },
      { dt: unix('2026-06-30T16:00:00Z'), sunrise: unix('2026-06-30T09:30:00Z'), sunset: 0 },
    ],
  } });
  expect(detailsValues(view)).toMatchObject({ Sunrise: '05:30', Sunset: '20:15' });
});
it('labels the UTC fallback and distinguishes real zeros from missing detail values', () => {
  const view = createWeatherDetails();
  view.update({ data: {
    timezone: 'Invalid/Zone',
    current: { dt: current.dt, sunset: current.dt, humidity: 0, wind_speed: 0, clouds: 0, uvi: 0, visibility: 0 },
    daily: [{ dt: current.dt + 86400, sunrise: current.dt + 86400 }],
  } });
  expect(view.element.querySelector('.details-timezone').textContent).toContain('UTC (timezone unavailable)');
  expect(detailsValues(view)).toEqual({
    Humidity: '0%', Wind: '0 m/s', Pressure: '—', Sunrise: '—', Sunset: '22:13',
    'UV index': '0', Visibility: '0 km', 'Cloud coverage': '0%',
  });
  view.update({ loading: true });
  expect(view.element.hidden).toBe(true);
  expect(detailsValues(view)).toEqual({});
});
it('uses safe text for backend descriptions', () => {
  const view = createCurrentWeather(vi.fn());
  view.update({
    data: { current: { ...current, weather: [{ description: '<script>bad()</script>' }] } },
  });
  expect(view.element.querySelector('script')).toBeNull();
  expect(view.element.textContent).toContain('<script>');
});
it.each(['../../bad', 'javascript:alert(1)', '99d', null])(
  'uses a neutral fallback for icon %s',
  (code) => {
    expect(createWeatherIcon(code, 'Conditions').querySelector('img')).toBeNull();
  },
);
it('uses HTTPS icons and recovers from an image error', () => {
  const view = createWeatherIcon('10d', 'Light rain');
  const image = view.querySelector('img');
  expect(image.src).toBe('https://openweathermap.org/img/wn/10d@2x.png');
  expect(image.alt).toBe('Light rain');
  image.dispatchEvent(new Event('error'));
  expect(view.querySelector('img')).toBeNull();
  expect(view.querySelector('[role=img]')).not.toBeNull();
});
