const pool = require('../db/pool');

const getWeatherRankingRows = async (db = pool) => {
  const result = await db.query(`
    SELECT
      id,
      username,
      COALESCE(score, 0)::float AS score,
      RANK() OVER (ORDER BY COALESCE(score, 0) DESC, id ASC)::int AS rank,
      COUNT(*) OVER ()::int AS total_users
    FROM users
    ORDER BY COALESCE(score, 0) DESC, id ASC
  `);

  return result.rows;
};

module.exports = {
  getWeatherRankingRows
};
