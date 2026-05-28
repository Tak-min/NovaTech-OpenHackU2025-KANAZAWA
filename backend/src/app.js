const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { sendSuccess } = require('./utils/apiResponse');
const authRoutes = require('./routes/authRoutes');
const statusRoutes = require('./routes/statusRoutes');
const locationRoutes = require('./routes/locationRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const userRoutes = require('./routes/userRoutes');
const mapRoutes = require('./routes/mapRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.frontendOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/', (req, res) => {
  sendSuccess(res, {
    message: 'SoraLog API Server is running',
    version: '2.0.0-rebuild',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['POST /register', 'POST /login', 'GET /user/info'],
      diagnosis: ['GET /status'],
      location: ['POST /log-location'],
      ranking: ['GET /ranking?type=weather&limit=50'],
      map: ['GET /users-locations'],
      settings: ['GET /user/settings', 'PUT /user/settings']
    }
  });
});

app.use(authRoutes);
app.use(statusRoutes);
app.use(locationRoutes);
app.use(rankingRoutes);
app.use(userRoutes);
app.use(mapRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
