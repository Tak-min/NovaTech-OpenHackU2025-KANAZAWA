const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const statusService = require('../services/statusService');

const router = express.Router();

router.get('/status', authenticate, asyncHandler(async (req, res) => {
  const status = await statusService.getStatus(req.user.id);
  sendSuccess(res, status);
}));

module.exports = router;
