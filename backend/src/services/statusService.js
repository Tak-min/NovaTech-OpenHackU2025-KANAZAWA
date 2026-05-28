const { AppError } = require('../utils/errors');
const userRepository = require('../repositories/userRepository');
const locationRepository = require('../repositories/locationRepository');
const { buildDiagnosis } = require('./scoreService');

const getStatus = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('ユーザーが見つかりません', 404, 'USER_NOT_FOUND');
  }

  const counts = await locationRepository.getCountsByUser(userId);
  const latestLog = await locationRepository.getLatestForUser(userId);
  const diagnosis = buildDiagnosis({
    score: user.score,
    counts
  });

  return {
    ...diagnosis,
    latestLog,
    user: userRepository.toPublicUser(user)
  };
};

module.exports = {
  getStatus
};
