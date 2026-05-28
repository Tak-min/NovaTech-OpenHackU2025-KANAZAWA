const axios = require('axios');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const { categoryFromWeatherCode } = require('./scoreService');

/**
 * 開発用モック天気を生成する。
 */
const generateMockWeather = () => {
  const mockCodes = [800, 801, 802, 500, 300, 600, 200];
  const code = mockCodes[Math.floor(Math.random() * mockCodes.length)];
  const categories = {
    800: { cat: 'sunny', desc: '快晴（モック）', city: 'Mock City (Sunny)' },
    801: { cat: 'cloudy', desc: '一部曇（モック）', city: 'Mock City (Cloudy)' },
    802: { cat: 'cloudy', desc: '曇り（モック）', city: 'Mock City (Cloudy)' },
    500: { cat: 'rainy', desc: '小雨（モック）', city: 'Mock City (Rainy)' },
    300: { cat: 'rainy', desc: '霧雨（モック）', city: 'Mock City (Drizzle)' },
    600: { cat: 'snowy', desc: '雪（モック）', city: 'Mock City (Snowy)' },
    200: { cat: 'thunderstorm', desc: '雷雨（モック）', city: 'Mock City (Storm)' }
  };
  const mock = categories[code];
  return {
    weatherCategory: mock.cat,
    weatherCode: code,
    city: mock.city,
    description: mock.desc,
    isMock: true
  };
};

const fetchCurrentWeather = async ({ latitude, longitude }) => {
  // APIキーが未設定かつ開発環境の場合はモックを返す
  if (!env.weatherApiKey || env.weatherApiKey === 'your_openweathermap_api_key') {
    if (!env.isProduction) {
      console.info('[weatherService] APIキー未設定のため、開発用モック天気を返します');
      return generateMockWeather();
    }
    throw new AppError('OpenWeatherMap API key is not configured', 503, 'WEATHER_API_UNCONFIGURED');
  }

  try {
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      timeout: 8000,
      params: {
        lat: latitude,
        lon: longitude,
        appid: env.weatherApiKey,
        units: 'metric',
        lang: 'ja'
      }
    });

    const weatherCode = Number(response.data?.weather?.[0]?.id);

    return {
      weatherCategory: categoryFromWeatherCode(weatherCode),
      weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
      city: response.data?.name || null,
      description: response.data?.weather?.[0]?.description || '',
      isMock: false
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('天気情報を取得できませんでした', 502, 'WEATHER_API_ERROR');
  }
};

module.exports = {
  fetchCurrentWeather
};
