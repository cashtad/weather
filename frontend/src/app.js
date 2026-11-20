import { createAuthDialog } from './components/AuthDialog.js';
import { createSession } from './auth/session.js';
import { createFavorites } from './favorites/favorites.js';
import { createHeader } from './components/Header.js';
import { createDashboard } from './components/Dashboard.js';
import { geoApi } from './api/geoApi.js';
import { weatherApi } from './api/weatherApi.js';
import { isAbortError } from './api/client.js';
import { detectLocation } from './location/detectLocation.js';
import {
  manualLocation,
  validCoordinates,
  saveManualLocation,
} from './location/preferences.js';

export function mountApp(root) {
  let destroyed = false;
  let locationGeneration = 0,
    searchGeneration = 0,
    weatherGeneration = 0;
  let detectionController, searchController, weatherController, searchTimer;
  let activeSearchQuery;
  const state = { location: null, loading: false, data: null, error: null };
  let account = { phase: 'guest' };
  const session = createSession(onSessionChange);
  const favorites = createFavorites(session, (view) => {
    header.search.updateFavorites(account, view);
    updateSave();
  });
  const header = createHeader({
    onSignIn: openSignIn,
    onSignOut: session.signOut,
    onRetry: session.restore,
    onQuery: search,
    onSelect: selectManual,
    onUseLocation: () => locate(false),
    onLoad: favorites.load,
    onRemoveFavorite: favorites.remove,
    onSelectFavorite: selectFavorite,
  });
  const dialog = createAuthDialog({
    onSubmit: session.authenticate,
    onCancel: session.cancelAuthentication,
    onRetry: session.restore,
    fallbackFocus: header.focusAction,
  });
  const dashboard = createDashboard({
    onRetry: loadWeather,
    onSaveFavorite: () => favorites.add(state.location),
  });
  const footer = document.createElement('footer');
  footer.className = 'site-footer shell';
  footer.innerHTML = `<span>Weather data: OpenWeather</span>
    <small>Approximate location uses <a href="https://ipwhois.io/documentation" target="_blank" rel="noopener noreferrer">ipwho.is</a> and shares your public IP.</small>`;
  root.replaceChildren(header.element, dashboard.element, footer, dialog.element);
  dashboard.updateWeather(state);

  function openSignIn(trigger) {
    if (account.phase === 'guest') dialog.open(trigger);
  }

  function updateSave() {
    dashboard.updateSave(favorites.saveState(state.location));
  }

  function onSessionChange(next) {
    account = next;
    header.update(account);
    favorites.reset();
    dialog.update(account);
    if (account.phase === 'authenticated') favorites.load();
  }

  function cancelSearch() {
    ++searchGeneration;
    clearTimeout(searchTimer);
    searchController?.abort();
    activeSearchQuery = undefined;
  }
  function selectManual(value) {
    const location = manualLocation(value);
    if (location) selectExplicit(location);
  }

  function selectFavorite(item) {
    const location = manualLocation(item);
    // Older favorites can have no country under the backend contract.
    const { name, lat, lon, state } = item;
    selectExplicit(location || { name, lat, lon, state, source: 'favorite' });
  }

  function selectExplicit(location) {
    if (!validCoordinates(location?.lat, location?.lon)) return;
    ++locationGeneration;
    detectionController?.abort();
    cancelSearch();
    header.search.update();
    header.search.setLocating(false);
    saveManualLocation(location);
    selectLocation(location);
  }
  function selectLocation(location) {
    if (destroyed || !validCoordinates(location?.lat, location?.lon)) return;
    state.location = location;
    const label =
      location.source === 'browser'
        ? 'Device location'
        : location.source === 'ip'
          ? 'Using approximate location'
          : location.source === 'default'
            ? 'Using the default location'
            : '';
    dashboard.setLocationStatus(label);
    updateSave();
    loadWeather();
  }
  async function locate(useSaved = true) {
    if (!useSaved) {
      cancelSearch();
      header.search.update();
      header.search.setLocating(true);
    }
    const generation = ++locationGeneration;
    detectionController?.abort();
    detectionController = new AbortController();
    try {
      const location = await detectLocation({
        useSaved,
        signal: detectionController.signal,
        onStatus: (message) => {
          if (!destroyed && generation === locationGeneration) dashboard.setLocationStatus(message);
        },
      });
      if (!destroyed && generation === locationGeneration) selectLocation(location);
    } catch (error) {
      if (!destroyed && generation === locationGeneration && !isAbortError(error)) {
        dashboard.setLocationStatus('Location unavailable. You can still search for a city.');
      }
    } finally {
      if (!destroyed && generation === locationGeneration) header.search.setLocating(false);
    }
  }
  function search(value, { immediate = false } = {}) {
    const query = value.trim();
    if (query === activeSearchQuery) return;
    cancelSearch();
    const generation = searchGeneration;
    if (query.length < 2) {
      header.search.update();
      return;
    }
    header.search.update({ status: 'loading' });
    const run = async () => {
      searchController = new AbortController();
      activeSearchQuery = query;
      try {
        const results = await geoApi.searchCities(query, { signal: searchController.signal });
        if (destroyed || generation !== searchGeneration) return;
        if (!Array.isArray(results)) throw new Error('Invalid city search response');
        header.search.update({
          status: 'success',
          items: results.map(manualLocation).filter(Boolean),
        });
      } catch (error) {
        if (!destroyed && generation === searchGeneration && !isAbortError(error))
          header.search.update({ status: 'error' });
      } finally {
        if (generation === searchGeneration) activeSearchQuery = undefined;
      }
    };
    if (immediate) run();
    else searchTimer = setTimeout(run, 300);
  }
  async function loadWeather() {
    if (destroyed || !state.location) return;
    const generation = ++weatherGeneration;
    weatherController?.abort();
    weatherController = new AbortController();
    const { lat, lon } = state.location;
    state.loading = true;
    state.error = null;
    state.data = null;
    dashboard.updateWeather(state);
    try {
      const data = await weatherApi.getAll(lat, lon, { signal: weatherController.signal });
      if (destroyed || generation !== weatherGeneration) return;
      if (!data || !data.current || typeof data.current !== 'object' || Array.isArray(data.current))
        throw new Error('Invalid weather response');
      state.data = data;
    } catch (error) {
      if (destroyed || generation !== weatherGeneration || isAbortError(error)) return;
      state.error =
        error.status === 0
          ? 'Unable to reach the weather server. Check your connection and retry.'
          : [502, 503].includes(error.status)
            ? 'Weather data is temporarily unavailable. Please try again.'
            : 'Unable to load weather. Please try again.';
    } finally {
      if (!destroyed && generation === weatherGeneration) {
        state.loading = false;
        dashboard.updateWeather(state);
      }
    }
  }
  session.restore();
  locate();
  return {
    destroy() {
      destroyed = true;
      ++locationGeneration;
      ++weatherGeneration;
      cancelSearch();
      detectionController?.abort();
      weatherController?.abort();
      session.destroy();
      account = { phase: 'guest' };
      favorites.reset();
      header.update(account);
      dialog.destroy();
      header.search.destroy();
    },
  };
}
