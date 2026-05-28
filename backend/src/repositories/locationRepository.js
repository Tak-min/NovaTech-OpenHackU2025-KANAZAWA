const pool = require('../db/pool');

const query = (db, text, params) => db.query(text, params);

const toLog = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    weatherCategory: row.weather_category,
    weatherCode: row.weather_code,
    city: row.city,
    scoreDelta: Number(row.score_delta || 0),
    recordedAt: row.recorded_at
  };
};

const getLatestForUser = async (userId, db = pool) => {
  const result = await query(
    db,
    `SELECT id, user_id, latitude, longitude, weather_category, weather_code, city, score_delta, recorded_at
     FROM weather_logs
     WHERE user_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId]
  );
  return toLog(result.rows[0]);
};

const insertLog = async (log, db = pool) => {
  const result = await query(
    db,
    `INSERT INTO weather_logs (
       user_id,
       latitude,
       longitude,
       weather_category,
       weather_code,
       city,
       score_delta,
       recorded_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, user_id, latitude, longitude, weather_category, weather_code, city, score_delta, recorded_at`,
    [
      log.userId,
      log.latitude,
      log.longitude,
      log.weatherCategory,
      log.weatherCode,
      log.city,
      log.scoreDelta
    ]
  );
  return toLog(result.rows[0]);
};

const getCountsByUser = async (userId, db = pool) => {
  const result = await query(
    db,
    `SELECT weather_category, COUNT(*)::int AS count
     FROM weather_logs
     WHERE user_id = $1
     GROUP BY weather_category`,
    [userId]
  );

  return result.rows.reduce((counts, row) => {
    counts[row.weather_category] = Number(row.count || 0);
    return counts;
  }, {});
};

const getLatestVisibleLocations = async (currentUserId, precisionDecimals, db = pool) => {
  const result = await query(
    db,
    `SELECT DISTINCT ON (u.id)
       u.id,
       u.username,
       u.gender,
       u.score,
       s.introduction_text,
       CASE
         WHEN u.id = $1 THEN wl.latitude
         ELSE ROUND(wl.latitude::numeric, $2::integer)::double precision
       END AS latitude,
       CASE
         WHEN u.id = $1 THEN wl.longitude
         ELSE ROUND(wl.longitude::numeric, $2::integer)::double precision
       END AS longitude,
       wl.weather_category,
       wl.city,
       wl.recorded_at
     FROM users u
     JOIN user_settings s ON s.user_id = u.id
     JOIN weather_logs wl ON wl.user_id = u.id
     WHERE s.location_visibility_enabled = true
       AND wl.latitude IS NOT NULL
       AND wl.longitude IS NOT NULL
     ORDER BY u.id, wl.recorded_at DESC`,
    [currentUserId, precisionDecimals]
  );

  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    gender: row.gender || 'unspecified',
    score: Number(row.score || 0),
    introductionText: row.introduction_text || '',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    weatherCategory: row.weather_category,
    city: row.city,
    recordedAt: row.recorded_at,
    isCurrentUser: row.id === currentUserId
  }));
};

module.exports = {
  getLatestForUser,
  insertLog,
  getCountsByUser,
  getLatestVisibleLocations
};
