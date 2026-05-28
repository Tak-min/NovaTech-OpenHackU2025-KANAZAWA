const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const authService = require('../services/authService');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, {
    message: 'ユーザー登録が成功しました',
    ...result
  }, 201);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, {
    message: 'ログインに成功しました',
    ...result
  });
}));

module.exports = router;
