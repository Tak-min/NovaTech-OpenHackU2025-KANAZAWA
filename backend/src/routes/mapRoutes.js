const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const mapService = require('../services/mapService');

const router = express.Router();

router.get('/users-locations', authenticate, asyncHandler(async (req, res) => {
  const users = await mapService.getUsersLocations(req.user.id);
  sendSuccess(res, { users });
}));

module.exports = router;
