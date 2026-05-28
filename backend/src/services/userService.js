const { AppError } = require('../utils/errors');
const userRepository = require('../repositories/userRepository');
const settingsRepository = require('../repositories/settingsRepository');

const parseBooleanSetting = (value, field) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  }

  throw new AppError('設定値を確認してください', 400, 'VALIDATION_ERROR', [
    { field, message: 'trueまたはfalseを指定してください' }
  ]);
};

const pickSettingValue = (input, keys) => {
  const key = keys.find((candidate) => input[candidate] != null);
  return key ? input[key] : undefined;
};

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
  const inputIntroductionText = input.introduction_text ?? input.introductionText;
  const introductionText = inputIntroductionText == null
    ? current.introduction_text
    : String(inputIntroductionText).trim();

  if (introductionText.length > 280) {
    throw new AppError('自己紹介は280文字以内で入力してください', 400, 'VALIDATION_ERROR', [
      { field: 'introduction_text', message: '自己紹介は280文字以内で入力してください' }
    ]);
  }

  const loggingValue = pickSettingValue(input, ['location_logging_enabled', 'locationLoggingEnabled', 'location_enabled']);
  const visibilityValue = pickSettingValue(input, [
    'location_visibility_enabled',
    'locationVisibilityEnabled',
    'location_public_enabled',
    'locationPublicEnabled',
    'location_enabled'
  ]);
  const notificationValue = pickSettingValue(input, ['notification_enabled', 'notificationEnabled']);

  const settings = {
    location_logging_enabled: loggingValue == null
      ? current.location_logging_enabled
      : parseBooleanSetting(loggingValue, 'location_logging_enabled'),
    location_visibility_enabled: visibilityValue == null
      ? current.location_visibility_enabled
      : parseBooleanSetting(visibilityValue, 'location_visibility_enabled'),
    notification_enabled: notificationValue == null
      ? current.notification_enabled
      : parseBooleanSetting(notificationValue, 'notification_enabled'),
    introduction_text: introductionText
  };

  return settingsRepository.updateForUser(userId, settings);
};

module.exports = {
  getCurrentUser,
  getSettings,
  updateSettings
};
