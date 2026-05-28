import { apiRequest } from './client.js';

export const getSettings = () => apiRequest('/user/settings');

export const updateSettings = (settings) => apiRequest('/user/settings', {
  method: 'PUT',
  body: settings
});
