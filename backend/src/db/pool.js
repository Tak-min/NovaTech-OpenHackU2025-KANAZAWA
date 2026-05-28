const { Pool } = require('pg');
const { env } = require('../config/env');

const shouldUseSsl =
  env.isProduction ||
  /sslmode=require/i.test(env.databaseUrl || '') ||
  /render\.com/i.test(env.databaseUrl || '');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

module.exports = pool;
