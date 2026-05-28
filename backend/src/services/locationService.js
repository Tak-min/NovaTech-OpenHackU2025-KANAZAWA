const pool = require('../db/pool');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const settingsRepository = require('../repositories/settingsRepository');
const locationRepository = require('../repositories/locationRepository');
const userRepository = require('../repositories/userRepository');
const { fetchCurrentWeather } = require('./weatherService');
const { scoreForCategory } = require('./scoreService');
const { getStatus } = require('./statusService');

const normalizeCoordinates = ({ latitude, longitude }) => {
  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);

  if (
    !Number.isFinite(normalizedLatitude) ||
    normalizedLatitude < -90 ||
    normalizedLatitude > 90
  ) {
    throw new AppError('緯度は-90から90の間で指定してください', 400, 'VALIDATION_ERROR', [
      { field: 'latitude', message: '緯度は-90から90の間で指定してください' }
    ]);
  }

  if (
    !Number.isFinite(normalizedLongitude) ||
    normalizedLongitude < -180 ||
    normalizedLongitude > 180
  ) {
    throw new AppError('経度は-180から180の間で指定してください', 400, 'VALIDATION_ERROR', [
      { field: 'longitude', message: '経度は-180から180の間で指定してください' }
    ]);
  }

  return {
    latitude: normalizedLatitude,
    longitude: normalizedLongitude
  };
};

const buildRateLimitPayload = (latestLog) => {
  if (!latestLog || env.logLocationMinIntervalSeconds <= 0) return null;

  const latestAt = new Date(latestLog.recordedAt).getTime();
  const nextAllowedAt = new Date(latestAt + env.logLocationMinIntervalSeconds * 1000);
  if (nextAllowedAt.getTime() <= Date.now()) return null;

  return {
    saved: false,
    skipped: true,
    reason: 'rate_limited',
    nextAllowedAt: nextAllowedAt.toISOString()
  };
};

/**
 * 天気を取得する。失敗時はunknownとしてフォールバック。
 * @param {object} coordinates - { latitude, longitude }
 * @returns {Promise<{weatherCategory: string, weatherCode: number|null, city: string|null, description: string, fallback: boolean}>}
 */
const fetchWeatherWithFallback = async (coordinates) => {
  try {
    const weather = await fetchCurrentWeather(coordinates);
    return { ...weather, fallback: false };
  } catch (_error) {
    // 天気API障害時: 位置情報は保存するが天気はunknownとする
    console.warn('[locationService] 天気取得失敗、unknownで記録を続行します');
    return {
      weatherCategory: 'unknown',
      weatherCode: null,
      city: null,
      description: '天気情報取得失敗',
      fallback: true
    };
  }
};

const logCurrentLocation = async (userId, input) => {
  const coordinates = normalizeCoordinates(input);
  const settings = await settingsRepository.getByUserId(userId);

  if (!settings.location_logging_enabled) {
    // 設定OFFの場合: 天気だけ確認（エラーは無視）
    let weather;
    try {
      weather = await fetchCurrentWeather(coordinates);
    } catch (_error) {
      weather = {
        weatherCategory: 'unknown',
        weatherCode: null,
        city: null,
        description: '天気情報取得失敗'
      };
    }
    const status = await getStatus(userId);
    return {
      saved: false,
      skipped: true,
      reason: 'location_logging_disabled',
      message: '位置情報ログ設定がOFFのため、天気だけ確認しました',
      weather,
      scoreDelta: 0,
      status
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [userId]);

    const latestLog = await locationRepository.getLatestForUser(userId, client);
    const rateLimited = buildRateLimitPayload(latestLog);
    if (rateLimited) {
      await client.query('COMMIT');
      return {
        ...rateLimited,
        message: '記録間隔内のため、今回は保存をスキップしました',
        status: await getStatus(userId)
      };
    }

    // 天気取得（失敗時はunknownフォールバック）
    const weather = await fetchWeatherWithFallback(coordinates);
    const scoreDelta = scoreForCategory(weather.weatherCategory);

    const log = await locationRepository.insertLog({
      userId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      weatherCategory: weather.weatherCategory,
      weatherCode: weather.weatherCode,
      city: weather.city,
      scoreDelta
    }, client);

    await userRepository.addScore(userId, scoreDelta, client);
    await client.query('COMMIT');

    return {
      saved: true,
      skipped: false,
      message: weather.fallback
        ? '位置情報を記録しました（天気情報は取得失敗のためunknownです）'
        : '現在地の天気を記録しました',
      weather,
      log,
      scoreDelta,
      status: await getStatus(userId)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  normalizeCoordinates,
  logCurrentLocation
};
