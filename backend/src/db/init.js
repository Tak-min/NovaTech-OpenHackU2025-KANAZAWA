const pool = require('./pool');

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
      SET location_visibility_enabled = COALESCE(location_visibility_enabled, location_public_enabled, false)
      WHERE location_visibility_enabled IS NULL;
    `);

    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_logging_enabled SET DEFAULT true;`);
    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_logging_enabled SET NOT NULL;`);
    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_visibility_enabled SET DEFAULT false;`);
    await client.query(`ALTER TABLE user_settings ALTER COLUMN location_visibility_enabled SET NOT NULL;`);

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
