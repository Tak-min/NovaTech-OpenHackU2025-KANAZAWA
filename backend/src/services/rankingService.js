const rankingRepository = require('../repositories/rankingRepository');
const { AppError } = require('../utils/errors');

const getRanking = async ({ userId, type = 'weather', limit = 50 }) => {
  if (type !== 'weather') {
    throw new AppError('このリビルドでは天気スコアランキングのみ対応しています', 400, 'UNSUPPORTED_RANKING_TYPE');
  }

  const requestedLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));
  const rows = await rankingRepository.getWeatherRankingRows();

  const rankings = rows.slice(0, requestedLimit).map((row) => ({
    rank: Number(row.rank),
    id: row.id,
    username: row.username,
    score: Number(row.score || 0),
    isCurrentUser: row.id === userId
  }));

  const currentUserRow = rows.find((row) => row.id === userId);
  const currentUserInTop = rankings.some((row) => row.isCurrentUser);
  const currentUserRank = currentUserRow && !currentUserInTop
    ? {
        rank: Number(currentUserRow.rank),
        id: currentUserRow.id,
        username: currentUserRow.username,
        score: Number(currentUserRow.score || 0),
        isCurrentUser: true
      }
    : null;

  return {
    type: 'weather',
    rankings,
    currentUserRank,
    totalUsers: rows[0]?.total_users ? Number(rows[0].total_users) : rows.length
  };
};

module.exports = {
  getRanking
};
