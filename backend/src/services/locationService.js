const pool = require('../db/pool');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const settingsRepository = require('../repositories/settingsRepository');
const locationRepository = require('../repositories/locationRepository');
const userRepository = require('../repositories/userRepository');
const { fetchCurrentWeather } = require('./weatherService');
const { scoreForCategory } = require('./scoreService');
const { getStatus } = require('./statusService');

const parseCoordinate = (value, { field, min, max, message }) => {
  const normalized = typeof value === 'string' && value.trim() === ''
    ? Number.NaN
    : Number(value);

  if (!Number.isFinite(normalized) || normalized < min || normalized > max) {
    throw new AppError(message, 400, 'VALIDATION_ERROR', [
      { field, message }
    ]);
  }

  return normalized;
};

const normalizeCoordinates = ({ latitude, longitude } = {}) => {
  const normalizedLatitude = parseCoordinate(latitude, {
    field: 'latitude',
    min: -90,
    max: 90,
    message: '緯度は-90から90の間で指定してください'
  });
  const normalizedLongitude = parseCoordinate(longitude, {
    field: 'longitude',
    min: -180,
    max: 180,
    message: '経度は-180から180の間で指定してください'
  });

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

const logCurrentLocation = async (userId, input) => {
  const coordinates = normalizeCoordinates(input);
  const settings = await settingsRepository.getByUserId(userId);

  if (!settings.location_logging_enabled) {
    const weather = await fetchCurrentWeather(coordinates);
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

    const weather = await fetchCurrentWeather(coordinates);
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
      message: '現在地の天気を記録しました',
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
