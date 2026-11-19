import { apiClient } from './client.js';

export const geoApi = {
  searchCities: (name, { signal } = {}) => apiClient.get('/geo/search', { query: { name }, signal }),
};
