require('dotenv').config();

const parseInteger = (value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

const defaultFrontendOrigins = [
  'https://soralog-qnka.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const configuredFrontendOrigins = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  nodeEnv,
  isProduction,
  port: process.env.PORT || 3000,
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  weatherApiKey: process.env.WEATHER_API_KEY,
  frontendOrigins: Array.from(new Set([...defaultFrontendOrigins, ...configuredFrontendOrigins])),
  logLocationMinIntervalSeconds: parseInteger(
    process.env.LOG_LOCATION_MIN_INTERVAL_SECONDS,
    300,
    { min: 0, max: 86400 }
  ),
  locationPublicPrecisionDecimals: parseInteger(
    process.env.LOCATION_PUBLIC_PRECISION_DECIMALS,
    3,
    { min: 0, max: 5 }
  )
};

const validateRequiredEnv = () => {
  const missing = [];
  if (!env.databaseUrl) missing.push('DATABASE_URL');
  if (!env.jwtSecret) missing.push('JWT_SECRET');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = {
  env,
  validateRequiredEnv
};
