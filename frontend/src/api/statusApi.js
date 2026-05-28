import { apiRequest } from './client.js';

export const getStatus = () => apiRequest('/status');
