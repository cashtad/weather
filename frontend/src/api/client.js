const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', path = null, timestamp = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.path = path;
    this.timestamp = timestamp;
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError';
}

function fallbackMessage(status) {
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 502 || status === 503) return 'The service is temporarily unavailable. Please try again.';
  if (status >= 500) return 'Something went wrong on the server. Please try again.';
  return 'The request could not be completed.';
}

async function request(path, { method, query, body, token, signal } = {}) {
  if (!path.startsWith('/') || path.startsWith('//') || /[?#]/.test(path)) {
    throw new TypeError('Use an API-relative path and pass query parameters separately.');
  }
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null) parameters.set(name, String(value));
  }
  const url = `${API_BASE}${path}${parameters.size ? `?${parameters}` : ''}`;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);

  let response;
  let text;
  try {
    response = await fetch(url, { method, headers, body: serializedBody, signal, credentials: 'same-origin' });
    text = await response.text();
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      throw new DOMException('The request was cancelled.', 'AbortError');
    }
    throw new ApiError('Unable to reach the server. Check your connection and try again.', { path: url });
  }

  let data = null;
  let validJson = true;
  if (text.trim()) {
    try { data = JSON.parse(text); } catch { validJson = false; }
  }
  if (!response.ok) {
    const backendError = data && typeof data === 'object' && !Array.isArray(data)
      && typeof data.code === 'string' && typeof data.message === 'string' ? data : null;
    const safeMessage = backendError?.message.trim();
    // Server failures use safe local copy rather than surfacing internal diagnostics.
    const message = response.status < 500 && safeMessage && safeMessage.length <= 240 && !/[\r\n]/.test(safeMessage)
      ? safeMessage : fallbackMessage(response.status);
    throw new ApiError(message, {
      status: response.status,
      code: backendError?.code || `HTTP_${response.status}`,
      path: typeof backendError?.path === 'string' ? backendError.path : url,
      timestamp: typeof backendError?.timestamp === 'string' ? backendError.timestamp : null,
    });
  }
  if (!validJson) {
    throw new ApiError('The server returned an unreadable response.', {
      status: response.status, code: 'INVALID_RESPONSE', path: url,
    });
  }
  return data;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
