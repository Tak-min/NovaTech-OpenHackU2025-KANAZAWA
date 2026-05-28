const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const locationService = require('../services/locationService');

const router = express.Router();

const validateCoordinates = (body) => {
  const value = {
    latitude: body.latitude,
    longitude: body.longitude
  };

  const errors = [];
  if (value.latitude == null) {
    errors.push({ field: 'latitude', message: '緯度が必要です' });
  }
  if (value.longitude == null) {
    errors.push({ field: 'longitude', message: '経度が必要です' });
  }

  return { value, errors };
};

router.post(
  '/log-location',
  authenticate,
  validateBody(validateCoordinates),
  asyncHandler(async (req, res) => {
    const result = await locationService.logCurrentLocation(req.user.id, req.validatedBody);
    sendSuccess(res, result, result.saved ? 201 : 200);
  })
);

module.exports = router;
