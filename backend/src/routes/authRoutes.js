const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const authService = require('../services/authService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// レート制限: 認証エンドポイント用
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分間
  max: 20, // 最大20リクエスト
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'リクエスト数が多すぎます。しばらく待ってからお試しください。'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, {
    message: 'ユーザー登録が成功しました',
    ...result
  }, 201);
}));

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, {
    message: 'ログインに成功しました',
    ...result
  });
}));

module.exports = router;
