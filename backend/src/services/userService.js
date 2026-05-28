const { AppError } = require('../utils/errors');
const userRepository = require('../repositories/userRepository');
const settingsRepository = require('../repositories/settingsRepository');

const getCurrentUser = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('ユーザーが見つかりません', 404, 'USER_NOT_FOUND');
  }
  return userRepository.toPublicUser(user);
};

const getSettings = async (userId) => {
  await getCurrentUser(userId);
  return settingsRepository.getByUserId(userId);
};

const updateSettings = async (userId, input = {}) => {
  await getCurrentUser(userId);

  const current = await settingsRepository.getByUserId(userId);
  const introductionText = input.introduction_text == null
    ? current.introduction_text
    : String(input.introduction_text).trim();

  if (introductionText.length > 280) {
    throw new AppError('自己紹介は280文字以内で入力してください', 400, 'VALIDATION_ERROR', [
      { field: 'introduction_text', message: '自己紹介は280文字以内で入力してください' }
    ]);
  }

  const settings = {
    location_logging_enabled: input.location_logging_enabled == null
      ? current.location_logging_enabled
      : Boolean(input.location_logging_enabled),
    location_visibility_enabled: input.location_visibility_enabled == null
      ? current.location_visibility_enabled
      : Boolean(input.location_visibility_enabled),
    notification_enabled: input.notification_enabled == null
      ? current.notification_enabled
      : Boolean(input.notification_enabled),
    introduction_text: introductionText
  };

  return settingsRepository.updateForUser(userId, settings);
};

module.exports = {
  getCurrentUser,
  getSettings,
  updateSettings
};
