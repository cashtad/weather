import { apiClient } from './client.js';

function getWeather(kind, lat, lon, { signal } = {}) {
  return apiClient.get(`/weather/${kind}`, { query: { lat, lon }, signal });
}

export const weatherApi = {
  getCurrent: (lat, lon, options) => getWeather('current', lat, lon, options),
  getHourly: (lat, lon, options) => getWeather('hourly', lat, lon, options),
  getDaily: (lat, lon, options) => getWeather('daily', lat, lon, options),
  getAll: (lat, lon, options) => getWeather('all', lat, lon, options),
};
