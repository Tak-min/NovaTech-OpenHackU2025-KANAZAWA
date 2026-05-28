const rankingRepository = require('../repositories/rankingRepository');
const { AppError } = require('../utils/errors');

const getRanking = async ({ userId, type = 'weather', limit = 50 }) => {
  if (type !== 'weather') {
    throw new AppError('このリビルドでは天気スコアランキングのみ対応しています', 400, 'UNSUPPORTED_RANKING_TYPE');
  }

  const requestedLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));

  // サーバーサイドでLIMITを適用
  const rows = await rankingRepository.getWeatherRankingRows(requestedLimit);

  const rankings = rows.map((row) => ({
    rank: Number(row.rank),
    id: row.id,
    username: row.username,
    score: Number(row.score || 0),
    isCurrentUser: row.id === userId
  }));

  const totalUsers = rows[0]?.total_users ? Number(rows[0].total_users) : rows.length;

  // 自分がランキング圏外の場合、別途ユーザーのランクをピンポイントで取得
  const currentUserInTop = rankings.some((row) => row.isCurrentUser);
  let currentUserRank = null;

  if (!currentUserInTop && userId) {
    const userRow = await rankingRepository.getUserRank(userId);
    if (userRow) {
      currentUserRank = {
        rank: Number(userRow.rank),
        id: userRow.id,
        username: userRow.username,
        score: Number(userRow.score || 0),
        isCurrentUser: true
      };
    }
  }

  return {
    type: 'weather',
    rankings,
    currentUserRank,
    totalUsers
  };
};

module.exports = {
  getRanking
};
