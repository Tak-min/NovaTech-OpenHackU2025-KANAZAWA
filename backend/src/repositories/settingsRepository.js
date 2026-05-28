const pool = require('../db/pool');

const query = (db, text, params) => db.query(text, params);

const DEFAULT_SETTINGS = {
  location_logging_enabled: true,
  location_visibility_enabled: false,
  notification_enabled: true,
  introduction_text: ''
};

const normalizeSettings = (row) => ({
  location_logging_enabled: row?.location_logging_enabled ?? DEFAULT_SETTINGS.location_logging_enabled,
  location_visibility_enabled: row?.location_visibility_enabled ?? DEFAULT_SETTINGS.location_visibility_enabled,
  notification_enabled: row?.notification_enabled ?? DEFAULT_SETTINGS.notification_enabled,
  introduction_text: row?.introduction_text || ''
});

const ensureForUser = async (userId, db = pool) => {
  const result = await query(
    db,
    `INSERT INTO user_settings (
       user_id,
       location_logging_enabled,
       location_visibility_enabled,
       notification_enabled,
       introduction_text,
       created_at,
       updated_at
     )
     VALUES ($1, true, false, true, '', NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET updated_at = user_settings.updated_at
     RETURNING location_logging_enabled, location_visibility_enabled, notification_enabled, introduction_text`,
    [userId]
  );
  return normalizeSettings(result.rows[0]);
};

/**
 * ユーザー設定を取得する（副作用なし）。
 * レコードが存在しない場合は新規作成して返す。
 */
const getByUserId = async (userId, db = pool) => {
  const result = await query(
    db,
    `SELECT location_logging_enabled, location_visibility_enabled, notification_enabled, introduction_text
     FROM user_settings
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    // 初回はINSERTして返す
    return ensureForUser(userId, db);
  }

  return normalizeSettings(result.rows[0]);
};

const updateForUser = async (userId, settings, db = pool) => {
  const result = await query(
    db,
    `INSERT INTO user_settings (
       user_id,
       location_logging_enabled,
       location_visibility_enabled,
       notification_enabled,
       introduction_text,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET location_logging_enabled = EXCLUDED.location_logging_enabled,
           location_visibility_enabled = EXCLUDED.location_visibility_enabled,
           notification_enabled = EXCLUDED.notification_enabled,
           introduction_text = EXCLUDED.introduction_text,
           updated_at = NOW()
     RETURNING location_logging_enabled, location_visibility_enabled, notification_enabled, introduction_text`,
    [
      userId,
      settings.location_logging_enabled,
      settings.location_visibility_enabled,
      settings.notification_enabled,
      settings.introduction_text
    ]
  );
  return normalizeSettings(result.rows[0]);
};

module.exports = {
  DEFAULT_SETTINGS,
  normalizeSettings,
  ensureForUser,
  getByUserId,
  updateForUser
};
