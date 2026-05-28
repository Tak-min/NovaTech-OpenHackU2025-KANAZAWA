const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const userService = require('../services/userService');

const router = express.Router();

router.get('/user/info', authenticate, asyncHandler(async (req, res) => {
  const user = await userService.getCurrentUser(req.user.id);
  sendSuccess(res, { user });
}));

router.get('/user/settings', authenticate, asyncHandler(async (req, res) => {
  const settings = await userService.getSettings(req.user.id);
  sendSuccess(res, settings);
}));

router.put('/user/settings', authenticate, asyncHandler(async (req, res) => {
  const settings = await userService.updateSettings(req.user.id, req.body || {});
  sendSuccess(res, {
    message: '設定を保存しました',
    settings
  });
}));

module.exports = router;
