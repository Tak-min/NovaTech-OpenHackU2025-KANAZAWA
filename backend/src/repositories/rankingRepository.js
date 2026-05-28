const pool = require('../db/pool');

/**
 * 天気スコアランキングの行を取得する。
 * @param {number} limit - 取得する最大件数 (1〜100)
 * @param {object} db - DBクライアント (デフォルトはpool)
 * @returns {Promise<Array>}
 */
const getWeatherRankingRows = async (limit = 100, db = pool) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));

  const result = await db.query(`
    SELECT
      id,
      username,
      COALESCE(score, 0)::float AS score,
      RANK() OVER (ORDER BY COALESCE(score, 0) DESC, id ASC)::int AS rank,
      COUNT(*) OVER ()::int AS total_users
    FROM users
    ORDER BY COALESCE(score, 0) DESC, id ASC
    LIMIT $1
  `, [safeLimit]);

  return result.rows;
};

/**
 * 特定のユーザーのランクを取得する。
 * @param {number} userId - 対象ユーザーID
 * @param {object} db - DBクライアント
 * @returns {Promise<object|null>}
 */
const getUserRank = async (userId, db = pool) => {
  const result = await db.query(`
    WITH ranked_users AS (
      SELECT
        id,
        username,
        COALESCE(score, 0)::float AS score,
        RANK() OVER (ORDER BY COALESCE(score, 0) DESC, id ASC)::int AS rank
      FROM users
    )
    SELECT * FROM ranked_users WHERE id = $1
  `, [userId]);

  return result.rows[0] || null;
};

module.exports = {
  getWeatherRankingRows,
  getUserRank
};
