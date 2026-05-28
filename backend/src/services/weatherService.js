const axios = require('axios');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const { categoryFromWeatherCode } = require('./scoreService');

const fetchCurrentWeather = async ({ latitude, longitude }) => {
  if (!env.weatherApiKey || env.weatherApiKey === 'your_openweathermap_api_key') {
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
      description: response.data?.weather?.[0]?.description || ''
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('天気情報を取得できませんでした', 502, 'WEATHER_API_ERROR');
  }
};

module.exports = {
  fetchCurrentWeather
};
