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

    // ─── 既存DB向けの互換マイグレーション ───

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
        ADD COLUMN IF NOT EXISTS score NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      ALTER TABLE users
        ALTER COLUMN gender TYPE VARCHAR(20),
        ALTER COLUMN gender SET DEFAULT 'unspecified',
        ALTER COLUMN score SET DEFAULT 0,
        ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      UPDATE users
      SET
        gender = COALESCE(gender, 'unspecified'),
        score = COALESCE(score, 0),
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
    `);

    await client.query(`
      ALTER TABLE users
        ALTER COLUMN gender SET NOT NULL,
        ALTER COLUMN score SET NOT NULL,
        ALTER COLUMN updated_at SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE weather_logs
        ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS weather_category VARCHAR(30),
        ADD COLUMN IF NOT EXISTS weather_code INTEGER,
        ADD COLUMN IF NOT EXISTS city VARCHAR(120),
        ADD COLUMN IF NOT EXISTS score_delta NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'weather_logs' AND column_name = 'weather'
        ) THEN
          EXECUTE $migration$
            UPDATE weather_logs
            SET weather_category = COALESCE(weather_category, NULLIF(weather, ''), 'unknown')
          $migration$;
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE weather_logs
      SET
        weather_category = COALESCE(weather_category, 'unknown'),
        score_delta = COALESCE(score_delta, 0),
        recorded_at = COALESCE(recorded_at, CURRENT_TIMESTAMP);
    `);

    await client.query(`
      ALTER TABLE weather_logs
        ALTER COLUMN weather_category SET DEFAULT 'unknown',
        ALTER COLUMN score_delta SET DEFAULT 0,
        ALTER COLUMN recorded_at SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN weather_category SET NOT NULL,
        ALTER COLUMN score_delta SET NOT NULL,
        ALTER COLUMN recorded_at SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS location_logging_enabled BOOLEAN,
        ADD COLUMN IF NOT EXISTS location_visibility_enabled BOOLEAN,
        ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN,
        ADD COLUMN IF NOT EXISTS introduction_text TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_settings' AND column_name = 'location_enabled'
        ) THEN
          EXECUTE 'UPDATE user_settings
                   SET location_logging_enabled = COALESCE(location_logging_enabled, location_enabled, true)';
        ELSE
          UPDATE user_settings
          SET location_logging_enabled = COALESCE(location_logging_enabled, true);
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_settings' AND column_name = 'location_public_enabled'
        ) THEN
          EXECUTE 'UPDATE user_settings
                   SET location_visibility_enabled = COALESCE(location_visibility_enabled, location_public_enabled, false)';
        ELSIF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_settings' AND column_name = 'location_enabled'
        ) THEN
          EXECUTE 'UPDATE user_settings
                   SET location_visibility_enabled = COALESCE(location_visibility_enabled, location_enabled, false)';
        ELSE
          UPDATE user_settings
          SET location_visibility_enabled = COALESCE(location_visibility_enabled, false);
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE user_settings
      SET
        notification_enabled = COALESCE(notification_enabled, true),
        introduction_text = COALESCE(introduction_text, ''),
        created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
    `);

    await client.query(`
      ALTER TABLE user_settings
        ALTER COLUMN location_logging_enabled SET DEFAULT true,
        ALTER COLUMN location_visibility_enabled SET DEFAULT false,
        ALTER COLUMN notification_enabled SET DEFAULT true,
        ALTER COLUMN introduction_text SET DEFAULT '',
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN location_logging_enabled SET NOT NULL,
        ALTER COLUMN location_visibility_enabled SET NOT NULL,
        ALTER COLUMN notification_enabled SET NOT NULL,
        ALTER COLUMN introduction_text SET NOT NULL,
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN updated_at SET NOT NULL;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'locations'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'locations' AND column_name = 'latitude'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'locations' AND column_name = 'longitude'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'locations' AND column_name = 'weather'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'locations' AND column_name = 'recorded_at'
        ) THEN
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
            l.user_id,
            l.latitude,
            l.longitude,
            COALESCE(NULLIF(l.weather, ''), 'unknown'),
            NULL,
            NULL,
            0,
            COALESCE(l.recorded_at, CURRENT_TIMESTAMP)
          FROM locations l
          WHERE l.user_id IS NOT NULL
            AND l.latitude IS NOT NULL
            AND l.longitude IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM weather_logs wl
              WHERE wl.user_id = l.user_id
                AND wl.recorded_at = COALESCE(l.recorded_at, CURRENT_TIMESTAMP)
            );
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE user_settings DROP COLUMN IF EXISTS location_public_enabled;
    `);

    await client.query(`
      ALTER TABLE user_settings DROP COLUMN IF EXISTS location_enabled;
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
