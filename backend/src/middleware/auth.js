const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('ログインが必要です', 401, 'AUTH_REQUIRED'));
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch (_) {
    return next(new AppError('認証の有効期限が切れたか、トークンが不正です', 401, 'INVALID_TOKEN'));
  }
};

module.exports = {
  authenticate
};
