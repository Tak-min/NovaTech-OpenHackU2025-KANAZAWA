const { env } = require('../config/env');
const locationRepository = require('../repositories/locationRepository');
const { buildDiagnosis } = require('./scoreService');

const getUsersLocations = async (currentUserId) => {
  const rows = await locationRepository.getLatestVisibleLocations(
    currentUserId,
    env.locationPublicPrecisionDecimals
  );

  return rows.map((row) => {
    const diagnosis = buildDiagnosis({
      score: row.score,
      counts: {}
    });

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
      diagnosisTitle: diagnosis.diagnosisTitle,
      diagnosisLabel: diagnosis.diagnosisLabel,
      score: row.score,
      isCurrentUser: row.isCurrentUser
    };
  });
};

module.exports = {
  getUsersLocations
};
