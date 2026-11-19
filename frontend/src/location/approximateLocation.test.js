import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { getApproximateLocation } from './approximateLocation.js';
const payload = {
  success: true,
  city: 'Brno',
  country: 'Czechia',
  region: 'South Moravia',
  latitude: 49.2,
  longitude: 16.6,
  ip: 'must-not-retain',
};
let fetchMock;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('requests only needed fields over HTTPS and discards IP metadata', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
  const result = await getApproximateLocation();
  expect(result).toEqual({
    name: 'Brno',
    country: 'Czechia',
    state: 'South Moravia',
    lat: 49.2,
    lon: 16.6,
    source: 'ip',
  });
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.protocol).toBe('https:');
  expect(url.hostname).toBe('ipwho.is');
  expect(url.searchParams.get('fields')).not.toContain('ip');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
});
it.each([
  { ...payload, success: false },
  { ...payload, latitude: null },
  { ...payload, longitude: 181 },
  { ...payload, city: '' },
  { ...payload, country: undefined },
])('rejects an invalid provider payload', async (data) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(data)));
  await expect(getApproximateLocation()).rejects.toThrow();
});
it.each([429, 500])('handles provider HTTP %i', async (status) => {
  fetchMock.mockResolvedValue(new Response('{}', { status }));
  await expect(getApproximateLocation()).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('handles invalid JSON', async () => {
  fetchMock.mockResolvedValue(new Response('{'));
  await expect(getApproximateLocation()).rejects.toThrow();
});
it('handles network failure', async () => {
  fetchMock.mockRejectedValue(new TypeError('offline'));
  await expect(getApproximateLocation()).rejects.toThrow();
});
it('bounds a fetch that ignores abort', async () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  const pending = getApproximateLocation();
  const rejected = expect(pending).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(4000);
  await rejected;
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});
it('bounds a stuck response body as well', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
  const pending = getApproximateLocation();
  const rejected = expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(4000);
  await rejected;
});
it('does not fetch when already cancelled', async () => {
  const c = new AbortController();
  c.abort();
  await expect(getApproximateLocation({ signal: c.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('cancels an active IP lookup and clears its deadline', async () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const pending = getApproximateLocation({ signal: controller.signal });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});
