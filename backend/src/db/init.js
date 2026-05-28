const pool = require('./pool');

const tableExists = async (client, tableName) => {
  const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [tableName]);
  return Boolean(result.rows[0]?.exists);
};

const columnExists = async (client, tableName, columnName) => {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = ANY (current_schemas(false))
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
};

const hasPostgisPointFunctions = async (client) => {
  const result = await client.query(`
    SELECT
      EXISTS (SELECT 1 FROM pg_proc WHERE LOWER(proname) = 'st_x') AS has_st_x,
      EXISTS (SELECT 1 FROM pg_proc WHERE LOWER(proname) = 'st_y') AS has_st_y
  `);
  return Boolean(result.rows[0]?.has_st_x && result.rows[0]?.has_st_y);
};

const normalizeLegacyWeatherExpression = (weatherTextExpression) => `
  CASE
    WHEN ${weatherTextExpression} LIKE '%thunder%' OR ${weatherTextExpression} LIKE '%雷%' THEN 'thunderstorm'
    WHEN ${weatherTextExpression} LIKE '%rain%' OR ${weatherTextExpression} LIKE '%drizzle%' OR ${weatherTextExpression} LIKE '%雨%' THEN 'rainy'
    WHEN ${weatherTextExpression} LIKE '%snow%' OR ${weatherTextExpression} LIKE '%雪%' THEN 'snowy'
    WHEN ${weatherTextExpression} LIKE '%clear%' OR ${weatherTextExpression} LIKE '%sun%' OR ${weatherTextExpression} LIKE '%晴%' THEN 'sunny'
    WHEN ${weatherTextExpression} LIKE '%cloud%' OR ${weatherTextExpression} LIKE '%曇%' OR ${weatherTextExpression} LIKE '%くもり%' THEN 'cloudy'
    WHEN ${weatherTextExpression} LIKE '%mist%' OR ${weatherTextExpression} LIKE '%fog%' OR ${weatherTextExpression} LIKE '%haze%'
      OR ${weatherTextExpression} LIKE '%dust%' OR ${weatherTextExpression} LIKE '%sand%'
      OR ${weatherTextExpression} LIKE '%ash%' OR ${weatherTextExpression} LIKE '%squall%'
      OR ${weatherTextExpression} LIKE '%tornado%' OR ${weatherTextExpression} LIKE '%smoke%' THEN 'stormy'
    ELSE 'unknown'
  END
`;

const scoreDeltaExpression = (categoryExpression = 'weather_category') => `
  CASE ${categoryExpression}
    WHEN 'sunny' THEN 1
    WHEN 'cloudy' THEN 0.5
    WHEN 'snowy' THEN 1
    WHEN 'rainy' THEN -1
    WHEN 'stormy' THEN -2
    WHEN 'thunderstorm' THEN -3
    ELSE 0
  END
`;

const backfillSettingsForExistingUsers = async (client) => {
  await client.query(`
    DELETE FROM user_settings current_row
    USING user_settings duplicate_row
    WHERE current_row.user_id = duplicate_row.user_id
      AND current_row.ctid < duplicate_row.ctid;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_unique
      ON user_settings (user_id);
  `);

  await client.query(`
    INSERT INTO user_settings (
      user_id,
      location_logging_enabled,
      location_visibility_enabled,
      notification_enabled,
      introduction_text,
      created_at,
      updated_at
    )
    SELECT id, true, false, true, '', NOW(), NOW()
    FROM users
    ON CONFLICT (user_id) DO NOTHING;
  `);
};

const importLegacyLocations = async (client) => {
  if (!(await tableExists(client, 'locations'))) return;
  if (!(await columnExists(client, 'locations', 'user_id'))) return;

  const hasLatitude = await columnExists(client, 'locations', 'latitude');
  const hasLongitude = await columnExists(client, 'locations', 'longitude');
  const hasGeom = await columnExists(client, 'locations', 'geom');
  const canReadGeom = hasGeom && await hasPostgisPointFunctions(client);

  if ((!hasLatitude || !hasLongitude) && !canReadGeom) {
    console.warn('Skipping legacy locations import: no latitude/longitude columns and PostGIS point functions are unavailable.');
    return;
  }

  const hasWeatherCategory = await columnExists(client, 'locations', 'weather_category');
  const hasWeather = await columnExists(client, 'locations', 'weather');
  const hasWeatherMain = await columnExists(client, 'locations', 'weather_main');
  const legacyWeatherColumn = hasWeatherCategory
    ? 'weather_category'
    : hasWeather
      ? 'weather'
      : hasWeatherMain
        ? 'weather_main'
        : null;

  const hasWeatherCode = await columnExists(client, 'locations', 'weather_code');
  const hasCity = await columnExists(client, 'locations', 'city');
  const hasScoreDelta = await columnExists(client, 'locations', 'score_delta');
  const hasRecordedAt = await columnExists(client, 'locations', 'recorded_at');
  const hasCreatedAt = await columnExists(client, 'locations', 'created_at');
  const hasId = await columnExists(client, 'locations', 'id');

  const latitudeExpression = hasLatitude ? 'l.latitude::double precision' : 'ST_Y(l.geom)::double precision';
  const longitudeExpression = hasLongitude ? 'l.longitude::double precision' : 'ST_X(l.geom)::double precision';
  const weatherTextExpression = legacyWeatherColumn
    ? `LOWER(COALESCE(l.${legacyWeatherColumn}::text, ''))`
    : `''`;
  const categoryExpression = normalizeLegacyWeatherExpression(weatherTextExpression);
  const weatherCodeExpression = hasWeatherCode
    ? `CASE WHEN l.weather_code::text ~ '^-?[0-9]+$' THEN l.weather_code::integer ELSE NULL::integer END`
    : 'NULL::integer';
  const cityExpression = hasCity ? 'l.city::text' : 'NULL::text';
  const recordedAtFallback = hasId
    ? `TIMESTAMP WITH TIME ZONE '1970-01-01 00:00:00+00' + (l.id * INTERVAL '1 second')`
    : 'NOW()';
  const recordedAtExpression = hasRecordedAt
    ? `COALESCE(l.recorded_at, ${recordedAtFallback})`
    : hasCreatedAt
      ? `COALESCE(l.created_at, ${recordedAtFallback})`
      : recordedAtFallback;

  const legacyScoreDeltaExpression = hasScoreDelta
    ? `CASE WHEN l.score_delta::text ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN l.score_delta::numeric ELSE NULL::numeric END`
    : 'NULL::numeric';
  const scoreDeltaSelect = `COALESCE(legacy_score_delta, ${scoreDeltaExpression('weather_category')})`;

  await client.query(`
    WITH legacy_rows AS (
      SELECT
        l.user_id,
        ${latitudeExpression} AS latitude,
        ${longitudeExpression} AS longitude,
        ${categoryExpression} AS weather_category,
        ${weatherCodeExpression} AS weather_code,
        ${cityExpression} AS city,
        ${legacyScoreDeltaExpression} AS legacy_score_delta,
        ${recordedAtExpression} AS recorded_at
      FROM locations l
      JOIN users u ON u.id = l.user_id
      WHERE ${latitudeExpression} IS NOT NULL
        AND ${longitudeExpression} IS NOT NULL
    ),
    scored_rows AS (
      SELECT
        user_id,
        latitude,
        longitude,
        weather_category,
        weather_code,
        city,
        ${scoreDeltaSelect} AS score_delta,
        recorded_at
      FROM legacy_rows
    )
    INSERT INTO weather_logs (
      user_id,
      latitude,
      longitude,
      weather_category,
      weather_code,
      city,
      score_delta,
      recorded_at
    )
    SELECT
      user_id,
      latitude,
      longitude,
      weather_category,
      weather_code,
      city,
      score_delta,
      recorded_at
    FROM scored_rows source_row
    WHERE NOT EXISTS (
      SELECT 1
      FROM weather_logs existing_row
      WHERE existing_row.user_id = source_row.user_id
        AND existing_row.recorded_at = source_row.recorded_at
        AND existing_row.latitude = source_row.latitude
        AND existing_row.longitude = source_row.longitude
        AND existing_row.weather_category = source_row.weather_category
    );
  `);
};

const initDb = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        gender VARCHAR(20) DEFAULT 'unspecified',
        score NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'unspecified';`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS score NUMERIC(10,2) NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weather_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        weather_category VARCHAR(30) NOT NULL,
        weather_code INTEGER,
        city VARCHAR(120),
        score_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
        recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        location_logging_enabled BOOLEAN,
        location_visibility_enabled BOOLEAN,
        notification_enabled BOOLEAN NOT NULL DEFAULT true,
        introduction_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN;`);
    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS location_public_enabled BOOLEAN;`);
    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS location_logging_enabled BOOLEAN;`);
    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS location_visibility_enabled BOOLEAN;`);
    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS introduction_text TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

    await client.query(`
      UPDATE user_settings
      SET location_logging_enabled = COALESCE(location_logging_enabled, location_enabled, true)
      WHERE location_logging_enabled IS NULL;
    `);

    await client.query(`
      UPDATE user_settings
      SET location_visibility_enabled = COALESCE(location_visibility_enabled, location_public_enabled, location_enabled, false)
      WHERE location_visibility_enabled IS NULL;
    `);

    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_logging_enabled SET DEFAULT true;`);
    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_logging_enabled SET NOT NULL;`);
    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_visibility_enabled SET DEFAULT false;`);
    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_visibility_enabled SET NOT NULL;`);

    await backfillSettingsForExistingUsers(client);
    await importLegacyLocations(client);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weather_logs_user_recorded
        ON weather_logs (user_id, recorded_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weather_logs_recorded
        ON weather_logs (recorded_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_settings_user
        ON user_settings (user_id);
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  initDb
};
