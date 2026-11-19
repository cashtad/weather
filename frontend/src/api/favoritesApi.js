import { apiClient } from './client.js';

export const favoritesApi = {
  getAll: (token, { signal } = {}) => apiClient.get('/favorites', { token, signal }),
  add: ({ name, country, state, lat, lon, displayName }, token, { signal } = {}) => apiClient.post('/favorites',
    { name, country, state, lat, lon, displayName }, { token, signal }),
  remove: (id, token, { signal } = {}) => apiClient.delete(`/favorites/${encodeURIComponent(id)}`, { token, signal }),
};
