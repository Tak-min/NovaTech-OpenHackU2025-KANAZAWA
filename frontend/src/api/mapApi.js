import { apiRequest } from './client.js';

export const getUsersLocations = () => apiRequest('/users-locations');
