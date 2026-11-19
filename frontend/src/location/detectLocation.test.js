import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { detectLocation } from './detectLocation.js';
import { getBrowserLocation } from './browserLocation.js';
import { getApproximateLocation } from './approximateLocation.js';
import { PRAGUE } from './preferences.js';
vi.mock('./browserLocation.js', () => ({ getBrowserLocation: vi.fn() }));
vi.mock('./approximateLocation.js', () => ({ getApproximateLocation: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('localStorage', { getItem: () => null });
});
afterEach(() => vi.unstubAllGlobals());
it('prefers a saved manual city without any geolocation calls', async () => {
  const city = { version: 1, name: 'City', country: 'CZ', lat: 0, lon: 0, source: 'manual' };
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(city) });
  expect((await detectLocation()).name).toBe('City');
  expect(getBrowserLocation).not.toHaveBeenCalled();
  expect(getApproximateLocation).not.toHaveBeenCalled();
});
it('ignores malformed storage and accepts browser location', async () => {
  vi.stubGlobal('localStorage', { getItem: () => '{' });
  getBrowserLocation.mockResolvedValue({
    name: 'Current location',
    lat: 1,
    lon: 2,
    source: 'browser',
  });
  expect((await detectLocation()).source).toBe('browser');
  expect(getApproximateLocation).not.toHaveBeenCalled();
});
it('falls back to approximate location after browser failure', async () => {
  getBrowserLocation.mockRejectedValue(new Error('permission denied'));
  getApproximateLocation.mockResolvedValue({ ...PRAGUE, source: 'ip' });
  expect((await detectLocation()).source).toBe('ip');
  expect(getBrowserLocation).toHaveBeenCalledTimes(1);
  expect(getApproximateLocation).toHaveBeenCalledTimes(1);
});
it('falls back to Prague when both methods fail', async () => {
  getBrowserLocation.mockRejectedValue(new Error('unavailable'));
  getApproximateLocation.mockRejectedValue(new Error('unavailable'));
  expect(await detectLocation()).toEqual(PRAGUE);
});
it('never continues a cancelled location chain', async () => {
  getBrowserLocation.mockRejectedValue(new DOMException('cancelled', 'AbortError'));
  await expect(detectLocation()).rejects.toMatchObject({ name: 'AbortError' });
  expect(getApproximateLocation).not.toHaveBeenCalled();
});

it('an explicit device-location request bypasses the saved preference', async () => {
  vi.stubGlobal('localStorage', {
    getItem: () =>
      JSON.stringify({
        version: 1,
        source: 'manual',
        name: 'Saved',
        country: 'CZ',
        lat: 1,
        lon: 2,
      }),
  });
  getBrowserLocation.mockResolvedValue({
    name: 'Current location',
    lat: 3,
    lon: 4,
    source: 'browser',
  });
  expect((await detectLocation({ useSaved: false })).source).toBe('browser');
  expect(getApproximateLocation).not.toHaveBeenCalled();
});
