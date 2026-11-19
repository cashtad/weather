import { it, expect } from 'vitest';
import {
  EMPTY_VALUE,
  formatTemperature,
  formatWind,
  formatHumidity,
  formatPressure,
  formatProbability,
  formatUnix,
  weatherTimeZone,
  weatherDescription,
} from './weatherFormat.js';
const unix = (value) => Date.parse(value) / 1000;
const hour = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
it('preserves UTC instants and uses positive IANA offsets only for display', () => {
  const ts = unix('2026-01-01T00:00:00Z');
  expect(formatUnix(ts, 'Europe/Prague', hour)).toBe('01:00');
  expect(ts).toBe(unix('2026-01-01T00:00:00Z'));
});
it('uses negative offsets and crosses the date boundary correctly', () => {
  expect(
    formatUnix(unix('2026-01-01T01:30:00Z'), 'America/New_York', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...hour,
    }),
  ).toContain('31/12/2025');
});
it('handles the spring daylight saving transition', () => {
  expect(formatUnix(unix('2026-03-29T00:30:00Z'), 'Europe/Prague', hour)).toBe('01:30');
  expect(formatUnix(unix('2026-03-29T01:30:00Z'), 'Europe/Prague', hour)).toBe('03:30');
});
it('handles the repeated autumn hour without mutating timestamps', () => {
  expect(formatUnix(unix('2026-10-25T00:30:00Z'), 'Europe/Prague', hour)).toBe('02:30');
  expect(formatUnix(unix('2026-10-25T01:30:00Z'), 'Europe/Prague', hour)).toBe('02:30');
});
it.each([undefined, null, '', 'Not/AZone', '+02:00'])(
  'explicitly falls back to UTC for %s',
  (zone) => {
    expect(weatherTimeZone(zone)).toEqual({ name: 'UTC', fallback: true });
    expect(formatUnix(unix('2026-01-01T01:30:00Z'), zone, hour)).toBe('01:30');
  },
);
it.each([null, undefined, NaN, Infinity, '20'])(
  'never invents numeric measurements for %s',
  (value) => {
    for (const format of [
      formatTemperature,
      formatWind,
      formatHumidity,
      formatPressure,
      formatProbability,
    ])
      expect(format(value)).toBe(EMPTY_VALUE);
  },
);
it('keeps actual zero and metric units', () => {
  expect(formatTemperature(0)).toContain('0');
  expect(formatWind(2.34)).toBe('2.3 m/s');
  expect(formatHumidity(0)).toBe('0%');
  expect(formatPressure(1001)).toBe('1001 hPa');
  expect(formatProbability(0.2)).toBe('20%');
});
it('handles missing timestamps and descriptions', () => {
  expect(formatUnix(null, 'UTC', hour)).toBe(EMPTY_VALUE);
  expect(weatherDescription({})).toBe('Conditions unavailable');
  expect(weatherDescription('light rain')).toBe('Light rain');
});
