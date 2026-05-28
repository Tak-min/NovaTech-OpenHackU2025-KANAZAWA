const TOKEN_KEY = 'soralog.token';

export const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  settings: null,
  currentRoute: null
};

export const getToken = () => state.token;

export const setToken = (token) => {
  state.token = token || null;
  if (state.token) {
    localStorage.setItem(TOKEN_KEY, state.token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const setUser = (user) => {
  state.user = user || null;
};

export const setSettings = (settings) => {
  state.settings = settings || null;
};

export const clearSession = () => {
  setToken(null);
  setUser(null);
  setSettings(null);
};

export const isAuthenticated = () => Boolean(state.token);
