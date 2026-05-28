import { apiRequest } from './client.js';

export const getRanking = ({ limit = 50 } = {}) => apiRequest(`/ranking?type=weather&limit=${encodeURIComponent(limit)}`);
