import { favoritesApi } from '../api/favoritesApi.js';
import { validCoordinates, locationLabel } from '../location/preferences.js';

function safeName(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export function favoriteRequest(location) {
  if (
    !location ||
    location.source === 'browser' ||
    !safeName(location.name, 255) ||
    !validCoordinates(location.lat, location.lon)
  )
    return null;
  const displayName = locationLabel(location);
  if (!safeName(displayName, 255)) return null;
  // Geocoding returns ISO country codes. Optional longer country names fit only in displayName.
  return {
    name: location.name,
    country: safeName(location.country, 10) ? location.country : undefined,
    state: safeName(location.state, 255) ? location.state : undefined,
    lat: location.lat,
    lon: location.lon,
    displayName,
  };
}

function favoriteRecord(value) {
  if (
    typeof value?.id !== 'string' ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id) ||
    !safeName(value.name, 255) ||
    !safeName(value.displayName, 255) ||
    !validCoordinates(value.lat, value.lon)
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    country: safeName(value.country, 10) ? value.country : undefined,
    state: safeName(value.state, 255) ? value.state : undefined,
    lat: value.lat,
    lon: value.lon,
    displayName: value.displayName,
  };
}

const samePlace = (a, b) => a && b && a.lat === b.lat && a.lon === b.lon;
const saveErrorMessage = 'Unable to save city. Please try again.';
const initialState = () => ({
  phase: 'idle',
  items: [],
  saving: null,
  saveFailure: null,
  removing: new Set(),
  message: '',
});

export function createFavorites(session, onChange) {
  let state = initialState();
  const publish = () => onChange(state);

  function handleFailure(error, credentials, message) {
    if (error?.status === 401) session.expire(credentials.signal);
    else state.message = message;
  }

  return {
    reset() {
      state = initialState();
      publish();
    },

    async load() {
      const credentials = session.credentials();
      if (!credentials || ['loading', 'ready'].includes(state.phase)) return;
      state.phase = 'loading';
      state.message = '';
      publish();
      try {
        const result = await favoritesApi.getAll(credentials.token, { signal: credentials.signal });
        if (credentials.signal.aborted) return;
        if (!Array.isArray(result)) throw new Error('Invalid favorites response');
        state.items = result.map(favoriteRecord).filter(Boolean);
        state.phase = 'ready';
      } catch (error) {
        if (credentials.signal.aborted) return;
        state.phase = 'error';
        handleFailure(error, credentials, 'Unable to load favorites.');
      } finally {
        if (!credentials.signal.aborted) publish();
      }
    },

    saveState(location) {
      if (!session.credentials() || !location) return { visible: false };
      if (!favoriteRequest(location))
        return {
          visible: true,
          disabled: true,
          label: 'Save city',
          note: 'Search for a named city to save it.',
        };
      if (state.items.some((item) => samePlace(item, location)))
        return {
          visible: true,
          disabled: true,
          label: 'Saved',
          saved: true,
        };
      if (state.saving)
        return {
          visible: true,
          disabled: true,
          label: samePlace(state.saving, location) ? 'Saving city...' : 'Save city',
        };
      return {
        visible: true,
        disabled: state.phase !== 'ready',
        label: 'Save city',
        note: samePlace(state.saveFailure, location) ? saveErrorMessage : '',
      };
    },

    async add(location) {
      const credentials = session.credentials();
      const payload = favoriteRequest(location);
      if (
        !credentials ||
        !payload ||
        state.phase !== 'ready' ||
        state.saving ||
        state.items.some((item) => samePlace(item, payload))
      )
        return;
      state.saving = payload;
      state.saveFailure = null;
      state.message = '';
      publish();
      try {
        const result = await favoritesApi.add(payload, credentials.token, {
          signal: credentials.signal,
        });
        if (credentials.signal.aborted) return;
        const item = favoriteRecord(result);
        if (!item) throw new Error('Invalid favorite response');
        state.items = [...state.items.filter((saved) => saved.id !== item.id), item];
        state.message = 'City saved.';
      } catch (error) {
        if (!credentials.signal.aborted) {
          state.saveFailure = payload;
          handleFailure(error, credentials, saveErrorMessage);
        }
      } finally {
        if (!credentials.signal.aborted) {
          state.saving = null;
          publish();
        }
      }
    },

    async remove(id) {
      const credentials = session.credentials();
      if (!credentials || state.removing.has(id) || !state.items.some((item) => item.id === id))
        return;
      state.removing.add(id);
      state.message = '';
      publish();
      try {
        await favoritesApi.remove(id, credentials.token, { signal: credentials.signal });
        if (credentials.signal.aborted) return;
        state.items = state.items.filter((item) => item.id !== id);
        state.message = 'City removed.';
      } catch (error) {
        if (credentials.signal.aborted) return;
        if (error?.status === 404) {
          state.items = state.items.filter((item) => item.id !== id);
          state.message = 'This city was already removed.';
        } else {
          handleFailure(
            error,
            credentials,
            error?.status === 403
              ? 'You do not have permission to remove this city.'
              : 'Unable to remove city. Please try again.',
          );
        }
      } finally {
        if (!credentials.signal.aborted) {
          state.removing.delete(id);
          publish();
        }
      }
    },
  };
}
