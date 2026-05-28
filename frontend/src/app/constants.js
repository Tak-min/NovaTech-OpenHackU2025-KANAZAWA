export const API_BASE = window.__API_BASE__
  || import.meta.env.VITE_API_BASE
  || (['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000'
    : 'https://soralog-backend.onrender.com');

export const ROUTES = {
  auth: 'auth',
  home: 'home',
  map: 'map',
  ranking: 'ranking',
  settings: 'settings'
};

export const WEATHER_META = {
  sunny: {
    label: '晴れ',
    tone: 'sunny',
    image: '/img/hare_f.png'
  },
  cloudy: {
    label: 'くもり',
    tone: 'cloudy',
    image: '/img/background-sky.png'
  },
  rainy: {
    label: '雨',
    tone: 'rainy',
    image: '/img/ame_f.png'
  },
  snowy: {
    label: '雪',
    tone: 'snowy',
    image: '/img/map-snow.png'
  },
  thunderstorm: {
    label: '雷雨',
    tone: 'stormy',
    image: '/img/ame_m.png'
  },
  stormy: {
    label: '荒天',
    tone: 'stormy',
    image: '/img/ame_m.png'
  },
  unknown: {
    label: '不明',
    tone: 'neutral',
    image: '/img/footer-img.png'
  }
};

export const DIAGNOSIS_META = {
  'Sun Chaser': {
    tone: 'sunny',
    image: '/img/hare_f.png'
  },
  'Sunny Person': {
    tone: 'sunny',
    image: '/img/hare_m.png'
  },
  'Rainy Person': {
    tone: 'rainy',
    image: '/img/ame_f.png'
  },
  'Storm Bringer': {
    tone: 'stormy',
    image: '/img/ame_m.png'
  },
  'Weather Neutral': {
    tone: 'neutral',
    image: '/img/background-sky.png'
  }
};
