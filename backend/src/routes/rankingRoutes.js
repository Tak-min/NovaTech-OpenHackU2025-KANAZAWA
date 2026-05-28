const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const rankingService = require('../services/rankingService');

const router = express.Router();

const validateRankingQuery = (query) => {
  const type = query.type ? String(query.type) : 'weather';
  const limit = query.limit == null ? 50 : Number.parseInt(query.limit, 10);
  const errors = [];

  if (type !== 'weather') {
    errors.push({ field: 'type', message: 'typeはweatherのみ対応しています' });
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    errors.push({ field: 'limit', message: 'limitは1から100の数値で指定してください' });
  }

  return {
    value: {
      type,
      limit
    },
    errors
  };
};

router.get('/ranking', authenticate, validateQuery(validateRankingQuery), asyncHandler(async (req, res) => {
  const ranking = await rankingService.getRanking({
    userId: req.user.id,
    ...req.validatedQuery
  });
  sendSuccess(res, ranking);
}));

module.exports = router;
