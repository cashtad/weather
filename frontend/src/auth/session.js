import { authApi } from '../api/authApi.js';

export const SESSION_KEY = 'weather-dashboard.session.v1';

function usableToken(value) {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 8192 && /^[!-~]+$/.test(value)
  );
}

function storedToken() {
  try {
    const value = globalThis.sessionStorage.getItem(SESSION_KEY);
    if (usableToken(value)) return value;
    if (value !== null) globalThis.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage restrictions do not prevent signing in for the current page.
  }
  return null;
}

function storeToken(value) {
  try {
    if (value) globalThis.sessionStorage.setItem(SESSION_KEY, value);
    else globalThis.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // The active session still works in memory.
  }
}

function profile(data) {
  if (
    typeof data?.id !== 'string' ||
    !data.id.trim() ||
    typeof data.email !== 'string' ||
    !data.email.trim() ||
    typeof data.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(data.createdAt))
  ) {
    throw new Error('Invalid account response');
  }
  return { id: data.id, email: data.email, createdAt: data.createdAt };
}

function authenticationError(error, mode) {
  if (error?.status === 401) return 'Invalid email or password.';
  if (error?.status === 409 && mode === 'register') return 'Email already registered.';
  if (error?.status === 400) return 'Check your email and password and try again.';
  if (error?.status === 0) return 'Unable to connect. Check your connection and try again.';
  if (error?.status >= 500)
    return 'The account service is temporarily unavailable. Please try again.';
  return 'Unable to complete the account request. Please try again.';
}

export function createSession(onChange) {
  let token = storedToken();
  let request = new AbortController();
  let state = { phase: 'guest' };
  let disposed = false;

  function publish(phase, details = {}) {
    state = { phase, ...details };
    onChange(state);
  }

  function renewRequest() {
    request.abort();
    request = new AbortController();
    return request.signal;
  }

  function signOut(message) {
    if (disposed) return;
    renewRequest();
    token = null;
    storeToken(null);
    publish('guest', { message });
  }

  async function verify(signal) {
    publish('verifying');
    try {
      const user = profile(await authApi.getCurrentUser(token, { signal }));
      if (!signal.aborted) publish('authenticated', { user });
    } catch (error) {
      if (signal.aborted) return;
      if (error?.status === 401) signOut('Your session has expired. Please sign in again.');
      else
        publish('unavailable', {
          message: 'Unable to verify your session. Retry or sign out.',
        });
    }
  }

  return {
    restore() {
      if (disposed || ['verifying', 'authenticating', 'authenticated'].includes(state.phase))
        return;
      if (token) return verify(renewRequest());
      publish('guest');
    },

    async authenticate(mode, credentials) {
      if (disposed || state.phase !== 'guest') return;
      const signal = renewRequest();
      publish('authenticating', { mode });
      try {
        const response = await authApi[mode](credentials, { signal });
        if (signal.aborted) return;
        if (!usableToken(response?.token)) {
          publish('guest', {
            error: 'The server did not return a usable sign-in response. Please try again.',
          });
          return;
        }
        token = response.token;
        storeToken(token);
        await verify(signal);
      } catch (error) {
        if (!signal.aborted) publish('guest', { error: authenticationError(error, mode) });
      }
    },

    // The signal identifies this session even if the server issues the same JWT again.
    credentials() {
      return state.phase === 'authenticated' && !disposed
        ? { token, signal: request.signal }
        : null;
    },

    expire(signal) {
      if (
        !disposed &&
        state.phase === 'authenticated' &&
        signal === request.signal &&
        !signal.aborted
      ) {
        signOut('Your session has expired. Please sign in again.');
      }
    },

    cancelAuthentication() {
      if (state.phase === 'authenticating' || state.phase === 'verifying') signOut();
    },

    signOut: () => signOut('Signed out.'),

    destroy() {
      disposed = true;
      request.abort();
      token = null;
      state = { phase: 'guest' };
    },
  };
}
