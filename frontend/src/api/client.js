import { API_BASE } from '../app/constants.js';
import { getToken } from '../app/state.js';

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (_) {
    return {};
  }
};

export const apiRequest = async (path, options = {}) => {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  const token = getToken();
  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await parseJson(response);

  if (!response.ok || payload.success === false) {
    const error = payload.error || {};
    throw new ApiError(
      error.message || payload.message || '通信に失敗しました',
      response.status,
      error.code || 'API_ERROR',
      error.details
    );
  }

  return payload.data ?? payload;
};
