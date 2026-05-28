import { apiRequest } from './client.js';

export const logLocation = ({ latitude, longitude }) => apiRequest('/log-location', {
  method: 'POST',
  body: { latitude, longitude }
});
