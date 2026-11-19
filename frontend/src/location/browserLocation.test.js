import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { getBrowserLocation } from './browserLocation.js';
let geolocation;
beforeEach(() => {
  vi.useFakeTimers();
  geolocation = { getCurrentPosition: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  vi.stubGlobal('isSecureContext', true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('uses valid browser coordinates with bounded low accuracy options', async () => {
  geolocation.getCurrentPosition.mockImplementation((success) =>
    success({ coords: { latitude: 0, longitude: 0 } }),
  );
  await expect(getBrowserLocation()).resolves.toEqual({
    name: 'Current location',
    lat: 0,
    lon: 0,
    source: 'browser',
  });
  expect(geolocation.getCurrentPosition.mock.calls[0][2]).toEqual({
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 300000,
  });
});
it.each([1, 2, 3])(
  'handles browser error code %i without repeating permission requests',
  async (code) => {
    geolocation.getCurrentPosition.mockImplementation((success, error) => error({ code }));
    await expect(getBrowserLocation()).rejects.toThrow();
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  },
);
it('handles missing geolocation', async () => {
  vi.stubGlobal('navigator', {});
  await expect(getBrowserLocation()).rejects.toThrow('unavailable');
});
it('handles insecure contexts without requesting permission', async () => {
  vi.stubGlobal('isSecureContext', false);
  await expect(getBrowserLocation()).rejects.toThrow();
  expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
});
it('handles synchronous browser exceptions', async () => {
  geolocation.getCurrentPosition.mockImplementation(() => {
    throw new Error('blocked');
  });
  await expect(getBrowserLocation()).rejects.toThrow('unavailable');
});
it('rejects invalid coordinates', async () => {
  geolocation.getCurrentPosition.mockImplementation((success) =>
    success({ coords: { latitude: 999, longitude: null } }),
  );
  await expect(getBrowserLocation()).rejects.toThrow('invalid');
});
it('bounds permission waiting and ignores a late callback', async () => {
  const pending = getBrowserLocation();
  const rejected = expect(pending).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(9000);
  await rejected;
  geolocation.getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 50, longitude: 14 } });
  expect(vi.getTimerCount()).toBe(0);
});
it('aborts even while native permission remains pending', async () => {
  const controller = new AbortController();
  const pending = getBrowserLocation({ signal: controller.signal });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});
