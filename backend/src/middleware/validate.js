const { AppError } = require('../utils/errors');

const validateBody = (validator) => (req, res, next) => {
  const result = validator(req.body || {});
  if (result.errors && result.errors.length > 0) {
    return next(new AppError('入力内容を確認してください', 400, 'VALIDATION_ERROR', result.errors));
  }
  req.validatedBody = result.value;
  return next();
};

const validateQuery = (validator) => (req, res, next) => {
  const result = validator(req.query || {});
  if (result.errors && result.errors.length > 0) {
    return next(new AppError('クエリパラメータを確認してください', 400, 'VALIDATION_ERROR', result.errors));
  }
  req.validatedQuery = result.value;
  return next();
};

module.exports = {
  validateBody,
  validateQuery
};
