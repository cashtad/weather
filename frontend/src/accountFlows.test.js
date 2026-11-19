// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountApp } from './app.js';
import { detectLocation } from './location/detectLocation.js';
import { LOCATION_KEY, PRAGUE } from './location/preferences.js';
import { SESSION_KEY } from './auth/session.js';

vi.mock('./location/detectLocation.js', () => ({ detectLocation: vi.fn() }));

const favorite = {
  id: '2c73503f-45fa-4a89-9ab9-44fa0e6f195b',
  name: 'Brno',
  country: 'CZ',
  state: 'South Moravia',
  lat: 49.2,
  lon: 16.6,
  displayName: 'Brno, South Moravia, CZ',
};
const account = { id: 'user-a', email: 'a@example.test', createdAt: '2026-01-01T00:00:00Z' };
const browserLocation = { name: 'Current location', lat: 41, lon: 12, source: 'browser' };
const weather = { timezone: 'UTC', current: { dt: 1700000000, temp: 18 }, hourly: [], daily: [] };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const reply = (data, status = 200) =>
  new Response(data === null ? null : JSON.stringify(data), { status });
const tick = () => vi.advanceTimersByTimeAsync(0);
let root, app, fetchMock, routes;

function call(action) {
  root.querySelector(action).click();
}
function openSearch() {
  const input = root.querySelector('#city-search');
  input.focus();
  input.click();
  return input;
}
function visit(token) {
  if (token) sessionStorage.setItem(SESSION_KEY, token);
  app = mountApp(root);
}
function signIn(email = account.email) {
  call('.account-sign-in');
  const modal = root.querySelector('dialog');
  modal.querySelector('[name=email]').value = email;
  modal.querySelector('[name=password]').value = 'test-only-password';
  modal
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
async function chooseCity(name) {
  const input = openSearch();
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(300);
  call('#city-results li');
  await tick();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
  detectLocation.mockResolvedValue(PRAGUE);
  routes = {
    profile: () => reply(account),
    login: () => reply({ token: 'fixture-login-token' }),
    list: () => reply([]),
    add: () => reply(favorite),
    remove: () => reply(null),
    geo: () => reply([favorite]),
  };
  fetchMock = vi.fn(async (path, options) => {
    if (path.startsWith('/api/v1/weather/all?')) return reply(weather);
    if (path.startsWith('/api/v1/geo/search?')) return routes.geo();
    if (path === '/api/v1/user/me') return routes.profile(options);
    if (path === '/api/v1/auth/login') return routes.login(options);
    if (path === '/api/v1/favorites' && options.method === 'GET') return routes.list(options);
    if (path === '/api/v1/favorites' && options.method === 'POST') return routes.add(options);
    if (path === '/api/v1/favorites/' + favorite.id && options.method === 'DELETE')
      return routes.remove(options);
    throw new Error('Unexpected fixture request');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  app?.destroy();
  app = null;
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('loads public weather as a guest, hides saved places and opens sign-in from the header', async () => {
  visit();
  await tick();
  openSearch();
  expect(root.querySelector('.favorites-panel').hidden).toBe(true);
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/weather/all?lat=50.0755&lon=14.4378',
  ]);
  call('.account-sign-in');
  expect(root.querySelector('dialog').open).toBe(true);
});

it('validates a restored session before loading the empty list and keeps public calls unauthenticated', async () => {
  visit('fixture-stored-token');
  await tick();
  expect(root.querySelector('.account-email').textContent).toBe(account.email);
  openSearch();
  expect(root.querySelector('.favorites-panel').hidden).toBe(false);
  expect(root.querySelector('.favorites-status').textContent).toBe('No favorite cities yet.');
  const calls = fetchMock.mock.calls;
  expect(
    calls.filter(([, options]) => options.headers.Authorization).map(([path]) => path),
  ).toEqual(['/api/v1/user/me', '/api/v1/favorites']);
});

it('does not load favorites until session verification succeeds and offers retry', async () => {
  routes.profile = () => reply({}, 503);
  visit('fixture-stored-token');
  await tick();
  expect(root.querySelector('.account-retry').hidden).toBe(false);
  expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/favorites')).toBe(false);
  expect(root.querySelector('.current-temperature').textContent).toContain('18');
  routes.profile = () => reply(account);
  call('.account-retry');
  await tick();
  expect(root.querySelector('.favorites-status').textContent).toBe('No favorite cities yet.');
});

it('lists favorites safely and retries a temporary list failure', async () => {
  routes.list = () => reply({}, 500);
  visit('fixture-stored-token');
  await tick();
  openSearch();
  expect(root.querySelector('.favorites-status').textContent).toContain('Unable to load');
  routes.list = () => reply([{ ...favorite, displayName: '<img src=x onerror=alert(1)>' }]);
  call('.favorites-retry');
  await tick();
  expect(root.querySelector('.favorite-select').textContent).toContain('<img');
  expect(root.querySelector('.favorite-select img')).toBeNull();
});

it('saves only after an explicit action and prevents duplicate requests', async () => {
  const pending = deferred();
  routes.add = () => pending.promise;
  visit('fixture-stored-token');
  await tick();
  const save = root.querySelector('.save-favorite');
  const posts = () =>
    fetchMock.mock.calls.filter(
      ([path, options]) => path === '/api/v1/favorites' && options.method === 'POST',
    );
  expect(posts()).toHaveLength(0);
  save.click();
  save.click();
  expect(save.disabled).toBe(true);
  expect(posts()).toHaveLength(1);
  expect(JSON.parse(posts()[0][1].body)).toMatchObject({ name: 'Prague', country: 'Czechia' });
  pending.resolve(reply({ ...favorite, ...PRAGUE, displayName: 'Prague, Czechia' }));
  await tick();
  expect(save.textContent).toBe('Saved');
  save.click();
  expect(posts()).toHaveLength(1);
});

it('blocks GPS-only favorites without inventing city data', async () => {
  detectLocation.mockResolvedValue(browserLocation);
  visit('fixture-stored-token');
  await tick();
  expect(root.querySelector('.save-favorite').disabled).toBe(true);
  expect(root.querySelector('.save-note').textContent).toContain('named city');
  call('.save-favorite');
  expect(fetchMock.mock.calls.some(([, options]) => options.method === 'POST')).toBe(false);
});

it('keeps a pending save associated with its original city when weather changes', async () => {
  const pending = deferred();
  routes.add = () => pending.promise;
  visit('fixture-stored-token');
  await tick();
  call('.save-favorite');
  await chooseCity('Brno');
  pending.resolve(reply({ ...favorite, ...PRAGUE, displayName: 'Prague, Czechia' }));
  await tick();
  expect(root.querySelector('.location-name').textContent).toContain('Brno');
  expect(root.querySelector('.favorite-select').textContent).toContain('Prague');
  expect(root.querySelector('.save-favorite').textContent).toBe('Save city');
});

it.each([true, false])('keeps concurrent save and delete results in either order (%s)', async (saveFirst) => {
  const save = deferred();
  const remove = deferred();
  routes.list = () => reply([favorite]);
  routes.add = () => save.promise;
  routes.remove = () => remove.promise;
  visit('fixture-stored-token');
  await tick();
  call('.save-favorite');
  call('.favorite-remove');
  const finishSave = () => save.resolve(reply({
    ...PRAGUE,
    id: 'fd3febfe-d64a-4fad-a48b-dd52860ce2ac',
    displayName: 'Prague, Czechia',
  }));
  const finishRemove = () => remove.resolve(reply(null));
  const [first, second] = saveFirst ? [finishSave, finishRemove] : [finishRemove, finishSave];
  first();
  await tick();
  second();
  await tick();
  expect([...root.querySelectorAll('.favorite-select')].map((button) => button.textContent)).toEqual([
    'Prague, Czechia',
  ]);
  expect(root.querySelector('.save-favorite').textContent).toBe('Saved');
});

it('selects a favorite while detection is pending, including optional country', async () => {
  const pending = deferred();
  detectLocation.mockReturnValue(pending.promise);
  routes.list = () => reply([{ ...favorite, country: null }]);
  visit('fixture-stored-token');
  await tick();
  const search = openSearch();
  call('.favorite-select');
  await tick();
  expect(root.querySelector('.search-popup').hidden).toBe(true);
  expect(document.activeElement).toBe(search);
  pending.resolve(PRAGUE);
  await tick();
  expect(detectLocation.mock.calls[0][0].signal.aborted).toBe(true);
  expect(root.querySelector('.location-name').textContent).toContain('Brno');
  expect(
    fetchMock.mock.calls
      .filter(([path]) => path.startsWith('/api/v1/weather/'))
      .map(([path]) => path),
  ).toEqual(['/api/v1/weather/all?lat=49.2&lon=16.6']);
});

it.each([200, 404])(
  'removes a favorite on DELETE %i without losing selected weather',
  async (status) => {
    routes.list = () => reply([favorite]);
    const pending = deferred();
    routes.remove = () => pending.promise;
    visit('fixture-stored-token');
    await tick();
    call('.favorite-select');
    await tick();
    call('.favorite-remove');
    call('.favorite-remove');
    expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(
      1,
    );
    expect(root.querySelector('.favorite-remove').disabled).toBe(true);
    pending.resolve(reply(null, status));
    await tick();
    expect(root.querySelector('.favorite-remove')).toBeNull();
    expect(root.querySelector('.location-name').textContent).toContain('Brno');
    expect(localStorage.getItem(LOCATION_KEY)).not.toContain('fixture-stored-token');
  },
);

it.each([403, 500, 0])('keeps an item and the session when DELETE fails (%i)', async (status) => {
  routes.list = () => reply([favorite]);
  routes.remove = () => (status ? reply({}, status) : Promise.reject(new TypeError('Offline')));
  visit('fixture-stored-token');
  await tick();
  call('.favorite-remove');
  await tick();
  expect(root.querySelector('.favorite-select')).not.toBeNull();
  expect(root.querySelector('.favorites-status').textContent).toMatch(/Unable|permission/);
  expect(sessionStorage.getItem(SESSION_KEY)).toBe('fixture-stored-token');
});

it('expires the active session after a favorite mutation receives 401', async () => {
  routes.add = () => reply({}, 401);
  visit('fixture-stored-token');
  await tick();
  call('.save-favorite');
  await tick();
  expect(root.querySelector('.account-status').textContent).toContain('expired');
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  expect(root.querySelector('.save-favorite').hidden).toBe(true);
  expect(root.querySelector('.current-temperature')).not.toBeNull();
});

it('clears account data and ignores a late favorites list after logout', async () => {
  const pending = deferred();
  routes.list = () => pending.promise;
  visit('fixture-stored-token');
  await tick();
  call('.account-sign-out');
  pending.resolve(reply([favorite]));
  await tick();
  expect(root.querySelector('.favorite-select')).toBeNull();
  expect(root.querySelector('.account-email').textContent).toBe('');
  expect(root.querySelector('.current-temperature')).not.toBeNull();
  expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
});

it.each([200, 401])(
  'ignores a late create result from the previous account (%i)',
  async (status) => {
    const pending = deferred();
    routes.add = () => pending.promise;
    visit('fixture-stored-token');
    await tick();
    call('.save-favorite');
    call('.account-sign-out');
    routes.profile = () => reply({ ...account, email: 'b@example.test' });
    signIn('b@example.test');
    await tick();
    pending.resolve(reply(favorite, status));
    await tick();
    expect(root.querySelector('.account-email').textContent).toBe('b@example.test');
    expect(root.querySelector('.favorite-select')).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('fixture-login-token');
  },
);

it('presents safe save failures and allows another explicit attempt', async () => {
  routes.add = () => reply({}, 500);
  visit('fixture-stored-token');
  await tick();
  call('.save-favorite');
  await tick();
  expect(root.querySelector('.favorites-status').textContent).toContain('Unable to save');
  expect(root.querySelector('.save-note').textContent).toContain('Unable to save');
  expect(root.querySelector('.save-favorite').disabled).toBe(false);
});

it('shows the first five saved places and expands the whole list without another API call', async () => {
  routes.list = () => reply(Array.from({ length: 12 }, (_, index) => ({
    ...favorite,
    id: favorite.id.slice(0, -2) + String(index).padStart(2, '0'),
    displayName: `Saved place ${index + 1}`,
  })));
  visit('fixture-stored-token');
  await tick();
  const input = openSearch();
  expect(root.querySelectorAll('.favorite-row')).toHaveLength(5);
  expect(root.querySelector('.favorite-row [role=option]')).toBeNull();
  expect(input.getAttribute('aria-expanded')).toBe('false');
  const more = root.querySelector('.favorites-more');
  more.click();
  expect(more.getAttribute('aria-expanded')).toBe('true');
  expect(root.querySelectorAll('.favorite-row')).toHaveLength(12);
  expect(fetchMock.mock.calls.filter(([path]) => path === '/api/v1/favorites')).toHaveLength(1);
  more.focus();
  more.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(root.querySelector('.search-popup').hidden).toBe(true);
  expect(document.activeElement).toBe(input);
  input.click();
  expect(root.querySelectorAll('.favorite-row')).toHaveLength(5);
});

it('switches from saved places to search suggestions and clears private rows on logout', async () => {
  routes.list = () => reply([favorite]);
  visit();
  signIn();
  await tick();
  const input = openSearch();
  const panel = root.querySelector('.favorites-panel');
  expect(panel.hidden).toBe(false);
  expect(root.querySelector('.favorites-more').hidden).toBe(true);
  input.value = 'B';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(panel.hidden).toBe(true);
  expect(root.querySelector('#search-help').textContent).toContain('at least two');
  input.value = 'Br';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(300);
  expect(panel.hidden).toBe(true);
  expect(root.querySelector('#city-results').hidden).toBe(false);
  expect(input.getAttribute('aria-expanded')).toBe('true');
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(panel.hidden).toBe(false);
  expect(root.querySelector('#city-results').hidden).toBe(true);
  root.querySelector('main').dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(root.querySelector('.search-popup').hidden).toBe(true);
  call('.account-sign-out');
  openSearch();
  expect(panel.hidden).toBe(true);
  expect(panel.querySelector('.favorite-row')).toBeNull();
});

it('keeps keyboard focus in the saved list after removing the focused row', async () => {
  routes.list = () => reply([favorite, {
    ...favorite, id: 'fd3febfe-d64a-4fad-a48b-dd52860ce2ac', displayName: 'Next city',
  }]);
  visit('fixture-stored-token');
  await tick();
  openSearch();
  const remove = root.querySelector('.favorite-remove');
  remove.focus();
  remove.click();
  await tick();
  expect(root.querySelector('.search-popup').hidden).toBe(false);
  expect(document.activeElement.textContent).toContain('Next city');
});
