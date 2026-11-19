import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, isAbortError } from './client.js';

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function backendError(status, overrides = {}) {
  return { message: 'Validation failed', code: 'VALIDATION_ERROR', status,
    path: '/api/v1/weather/all', timestamp: '2026-01-01T00:00:00Z', ...overrides };
}

describe('API client', () => {
  it('returns JSON from a successful GET', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ lat: 49.1, current: { dt: 1700000000 } }));
    await expect(apiClient.get('/weather/all')).resolves.toEqual({ lat: 49.1, current: { dt: 1700000000 } });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/weather/all', expect.objectContaining({ method: 'GET' }));
  });

  it('encodes Unicode and reserved query characters without parameter injection', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const name = '\u010cesk\u00e9 Bud\u011bjovice & #?limit=99+%';
    await apiClient.get('/geo/search', { query: { name, ignored: undefined, absent: null, limit: 0 } });
    const url = new URL(fetchMock.mock.calls[0][0], 'http://frontend.example.test');
    expect(url.pathname).toBe('/api/v1/geo/search');
    expect(url.searchParams.get('name')).toBe(name);
    expect([...url.searchParams.keys()]).toEqual(['name', 'limit']);
    expect(url.searchParams.get('limit')).toBe('0');
    expect(url.hash).toBe('');
  });

  it('serializes a POST body and sends the JSON content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: 'test-only-token' }));
    await apiClient.post('/auth/login', { email: 'test@example.test', password: 'test-only-password' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'test@example.test', password: 'test-only-password' }),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }));
  });

  it('handles the backend empty HTTP 200 DELETE response', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    await expect(apiClient.delete('/favorites/id')).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it.each([204, 200])('handles an empty successful HTTP %i response', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await expect(apiClient.get('/favorites')).resolves.toBeNull();
  });

  it('handles a whitespace-only successful response', async () => {
    fetchMock.mockResolvedValue(new Response('   '));
    await expect(apiClient.get('/favorites')).resolves.toBeNull();
  });

  it.each([400, 401, 500])('rejects HTTP %i and preserves the actual HTTP status', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse(backendError(status), status));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ name: 'ApiError', status });
  });

  it('preserves useful ErrorResponse metadata and validation messages', async () => {
    fetchMock.mockResolvedValue(jsonResponse(backendError(400), 400));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({
      message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400,
      path: '/api/v1/weather/all', timestamp: '2026-01-01T00:00:00Z',
    });
  });

  it('trusts the HTTP status over inconsistent backend metadata', async () => {
    fetchMock.mockResolvedValue(jsonResponse(backendError(500), 400));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ status: 400 });
  });

  it('does not expose internal details from HTTP 500 errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(backendError(500, {
      message: 'java.lang.Exception: private stack trace', code: 'INTERNAL_ERROR', trace: 'private details',
    }), 500));
    const error = await apiClient.get('/weather/all').catch((failure) => failure);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Something went wrong on the server. Please try again.');
    expect(error).not.toHaveProperty('trace');
    expect(error).not.toHaveProperty('response');
  });

  it('uses a safe message for temporary upstream unavailability', async () => {
    fetchMock.mockResolvedValue(jsonResponse(backendError(503), 503));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({
      message: 'The service is temporarily unavailable. Please try again.', status: 503,
    });
  });

  it('handles an empty HTTP 401 error without redirecting or retrying', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(apiClient.get('/user/me')).rejects.toMatchObject({
      status: 401, code: 'HTTP_401', message: 'Please sign in to continue.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not surface HTML from a non-JSON proxy error', async () => {
    fetchMock.mockResolvedValue(new Response('<html>private proxy diagnostics</html>', { status: 502 }));
    const error = await apiClient.get('/weather/all').catch((failure) => failure);
    expect(error).toMatchObject({ status: 502, code: 'HTTP_502' });
    expect(error.message).not.toContain('private');
  });

  it('ignores unstructured error messages', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'private diagnostics' }, 400));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ message: 'The request could not be completed.' });
  });

  it('does not surface multiline diagnostic messages', async () => {
    fetchMock.mockResolvedValue(jsonResponse(backendError(400, { message: 'Error\n at internal.Class' }), 400));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ message: 'The request could not be completed.' });
  });

  it('rejects unreadable successful responses instead of pretending data loaded', async () => {
    fetchMock.mockResolvedValue(new Response('<html>not JSON</html>', { status: 200 }));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' });
  });

  it('distinguishes network failures from HTTP failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('network diagnostics'));
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('handles a failed response body read as a network failure', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.reject(new TypeError('broken stream')) });
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('passes AbortSignal through and preserves cancellation as AbortError', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const pending = apiClient.get('/weather/all', { signal: controller.signal });
    const result = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('recognizes cancellation even when fetch rejects with a custom abort reason', async () => {
    const controller = new AbortController();
    controller.abort('User changed city');
    fetchMock.mockRejectedValue(controller.signal.reason);
    const error = await apiClient.get('/weather/all', { signal: controller.signal }).catch((failure) => failure);
    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it('preserves cancellation during body reading', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200,
      text: () => Promise.reject(new DOMException('Aborted', 'AbortError')) });
    await expect(apiClient.get('/weather/all')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('attaches Bearer only when explicitly requested and never persists it', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})));
    await apiClient.get('/user/me', { token: 'test-only-token' });
    await apiClient.get('/weather/all');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-token');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Content-Type');
  });

  it.each(['https://other.example.test', '//other.example.test', '/weather/all?lat=1', '/weather/all#fragment'])
  ('rejects unsupported API paths: %s', async (path) => {
    await expect(apiClient.get(path)).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
