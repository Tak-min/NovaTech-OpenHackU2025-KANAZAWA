const pool = require('./pool');

const initDb = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ─── テーブル作成（全カラムを1つのDDLで定義） ───

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        gender VARCHAR(20) NOT NULL DEFAULT 'unspecified',
        score NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
        location_logging_enabled BOOLEAN NOT NULL DEFAULT true,
        location_visibility_enabled BOOLEAN NOT NULL DEFAULT false,
        notification_enabled BOOLEAN NOT NULL DEFAULT true,
        introduction_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ─── 移行: 旧カラム名からの移行（初回のみ有効） ───
    // 旧カラム location_enabled → location_logging_enabled に統合
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_settings' AND column_name = 'location_enabled'
        ) THEN
          UPDATE user_settings
          SET location_logging_enabled = COALESCE(location_logging_enabled, location_enabled, true);
          ALTER TABLE user_settings DROP COLUMN location_enabled;
        END IF;
      END $$;
    `);

    // 旧カラム location_public_enabled → location_visibility_enabled に統合
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_settings' AND column_name = 'location_public_enabled'
        ) THEN
          UPDATE user_settings
          SET location_visibility_enabled = COALESCE(location_visibility_enabled, location_public_enabled, false);
          ALTER TABLE user_settings DROP COLUMN location_public_enabled;
        END IF;
      END $$;
    `);

    // ─── インデックス作成 ───

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

    // 地図クエリ用の複合インデックス
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weather_logs_user_recorded_desc
        ON weather_logs (user_id, recorded_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_settings_visibility
        ON user_settings (location_visibility_enabled, user_id)
        WHERE location_visibility_enabled = true;
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
