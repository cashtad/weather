import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createSession, SESSION_KEY } from './session.js';
import { authApi } from '../api/authApi.js';

vi.mock('../api/authApi.js', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), getCurrentUser: vi.fn() },
}));

const user = { id: 'test-user', email: 'user@example.test', createdAt: '2026-01-01T00:00:00Z' };
const credentials = { email: user.email, password: 'test-only-password' };
let storage, current, session;

beforeEach(() => {
  vi.resetAllMocks();
  storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('localStorage', { setItem: vi.fn() });
  authApi.getCurrentUser.mockResolvedValue(user);
  authApi.login.mockResolvedValue({ token: 'fixture-sign-in-token' });
  authApi.register.mockResolvedValue({ token: 'fixture-registration-token' });
});
afterEach(() => {
  session?.destroy();
  vi.unstubAllGlobals();
});

function start(stored = null) {
  storage.getItem.mockReturnValue(stored);
  session = createSession((state) => {
    current = state;
  });
  return session.restore();
}

it('starts a guest without making a protected request', () => {
  start();
  expect(current.phase).toBe('guest');
  expect(authApi.getCurrentUser).not.toHaveBeenCalled();
});

it('validates a stored token and keeps only trusted safe profile fields', async () => {
  authApi.getCurrentUser.mockResolvedValue({ ...user, passwordHash: 'ignored' });
  await start('fixture-stored-token');
  expect(authApi.getCurrentUser).toHaveBeenCalledWith(
    'fixture-stored-token',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(current).toEqual({ phase: 'authenticated', user });
  expect(current).not.toHaveProperty('token');
});

it.each([' ', 'a b', 'token\r\n'])(
  'clears malformed storage without making requests',
  async (stored) => {
    await start(stored);
    expect(storage.removeItem).toHaveBeenCalledWith(SESSION_KEY);
    expect(authApi.getCurrentUser).not.toHaveBeenCalled();
  },
);

it('supports an in-memory sign-in when browser storage is unavailable', async () => {
  for (const method of ['getItem', 'setItem', 'removeItem'])
    storage[method].mockImplementation(() => {
      throw new Error('Blocked');
    });
  await start();
  await session.authenticate('login', credentials);
  expect(current.phase).toBe('authenticated');
  session.signOut();
  expect(current.phase).toBe('guest');
});

it('expires the current restored token on 401', async () => {
  authApi.getCurrentUser.mockRejectedValue({ status: 401 });
  await start('fixture-expired-token');
  expect(current).toMatchObject({ phase: 'guest', message: expect.stringContaining('expired') });
  expect(storage.removeItem).toHaveBeenCalledWith(SESSION_KEY);
});

it.each([0, 403, 500])('allows verifying again after a profile failure (%i)', async (status) => {
  authApi.getCurrentUser.mockRejectedValueOnce({ status });
  await start('fixture-stored-token');
  expect(current.phase).toBe('unavailable');
  expect(session.credentials()).toBeNull();
  expect(storage.removeItem).not.toHaveBeenCalled();
  await session.restore();
  expect(current.phase).toBe('authenticated');
});

it('does not accept malformed profile responses', async () => {
  authApi.getCurrentUser.mockResolvedValue({ email: 'user@example.test' });
  await start('fixture-stored-token');
  expect(current.phase).toBe('unavailable');
  expect(session.credentials()).toBeNull();
});

it.each(['login', 'register'])(
  'verifies the token issued by %s and stores only that token',
  async (mode) => {
    await start();
    await session.authenticate(mode, credentials);
    const token = mode === 'login' ? 'fixture-sign-in-token' : 'fixture-registration-token';
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(SESSION_KEY, token);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(authApi.getCurrentUser).toHaveBeenCalledWith(token, expect.anything());
    expect(current).toEqual({ phase: 'authenticated', user });
    if (mode === 'register') expect(authApi.login).not.toHaveBeenCalled();
  },
);

it.each([undefined, null, false, '', 'bad token'])(
  'rejects unusable token responses',
  async (token) => {
    authApi.login.mockResolvedValue({ token });
    await start();
    await session.authenticate('login', credentials);
    expect(current.error).toContain('usable');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(authApi.getCurrentUser).not.toHaveBeenCalled();
  },
);

it.each([
  ['login', 401, 'Invalid email or password.'],
  ['register', 409, 'Email already registered.'],
  ['register', 400, 'Check your email and password'],
  ['login', 0, 'Unable to connect'],
  ['login', 503, 'temporarily unavailable'],
])('presents safe %s errors for HTTP %i', async (mode, status, message) => {
  authApi[mode].mockRejectedValue({ status, message: 'Internal diagnostics' });
  await start();
  await session.authenticate(mode, credentials);
  expect(current.phase).toBe('guest');
  expect(current.error).toContain(message);
  expect(current.error).not.toContain('Internal diagnostics');
});

it('discards a late restoration result after logout', async () => {
  let resolve;
  authApi.getCurrentUser.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const pending = start('fixture-stored-token');
  session.signOut();
  resolve(user);
  await pending;
  expect(authApi.getCurrentUser.mock.calls[0][1].signal.aborted).toBe(true);
  expect(current.phase).toBe('guest');
  expect(session.credentials()).toBeNull();
});

it('prevents duplicates and discards a superseded login response', async () => {
  let resolve;
  authApi.login.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await start();
  const pending = session.authenticate('login', credentials);
  await session.authenticate('login', credentials);
  expect(authApi.login).toHaveBeenCalledTimes(1);
  session.cancelAuthentication();
  await session.authenticate('register', credentials);
  resolve({ token: 'fixture-old-token' });
  await pending;
  expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(
    SESSION_KEY,
    'fixture-registration-token',
  );
});

it('does not expire a new session when an older request returns 401', async () => {
  await start('fixture-stored-token');
  const old = session.credentials();
  session.signOut();
  await session.authenticate('login', credentials);
  expect(old.signal.aborted).toBe(true);
  session.expire(old.signal);
  expect(current.phase).toBe('authenticated');
  session.expire(session.credentials().signal);
  expect(current.phase).toBe('guest');
});
