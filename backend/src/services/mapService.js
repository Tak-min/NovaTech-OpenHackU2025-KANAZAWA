const { env } = require('../config/env');
const locationRepository = require('../repositories/locationRepository');
const { getDiagnosisTitle, getDiagnosisLabel } = require('./scoreService');

const getUsersLocations = async (currentUserId) => {
  const rows = await locationRepository.getLatestVisibleLocations(
    currentUserId,
    env.locationPublicPrecisionDecimals
  );

  return rows.map((row) => {
    // 実際のスコアから直接diagnosisTitle/Labelを生成（空のcountsを渡さない）
    const score = Number(row.score || 0);

    return {
      id: row.id,
      username: row.username,
      latitude: row.latitude,
      longitude: row.longitude,
      weatherCategory: row.weatherCategory,
      weather: row.weatherCategory,
      city: row.city,
      recordedAt: row.recordedAt,
      introductionText: row.introductionText,
      diagnosisTitle: getDiagnosisTitle(score),
      diagnosisLabel: getDiagnosisLabel(score),
      score,
      isCurrentUser: row.isCurrentUser
    };
  });
};

module.exports = {
  getUsersLocations
};
