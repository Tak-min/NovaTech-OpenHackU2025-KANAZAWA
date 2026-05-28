const { AppError } = require('../utils/errors');

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const code = error.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = statusCode === 500 ? 'サーバーエラーが発生しました' : error.message;

  if (statusCode >= 500) {
    console.error(`[${code}]`, error.message, error.stack);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(error.details ? { details: error.details } : {})
    }
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
