import { apiClient } from './client.js';

export const authApi = {
  register: ({ email, password }, { signal } = {}) => apiClient.post('/auth/register', { email, password }, { signal }),
  login: ({ email, password }, { signal } = {}) => apiClient.post('/auth/login', { email, password }, { signal }),
  getCurrentUser: (token, { signal } = {}) => apiClient.get('/user/me', { token, signal }),
};
