import { apiRequest } from './client.js';

export const register = (body) => apiRequest('/register', {
  method: 'POST',
  auth: false,
  body
});

export const login = (body) => apiRequest('/login', {
  method: 'POST',
  auth: false,
  body
});

export const getUserInfo = () => apiRequest('/user/info');
