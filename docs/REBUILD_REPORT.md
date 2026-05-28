# SoraLog Rebuild Report

Created: 2026-05-28

## 1. What Was Rebuilt

SoraLog was rebuilt as a clean full-stack web application while preserving the core product idea:

- Register and log in.
- Use browser geolocation only after an explicit user action.
- Send latitude/longitude to the backend.
- Fetch current weather from OpenWeatherMap on the backend.
- Save weather/location logs only when logging consent is enabled.
- Calculate a fun sunny/rainy diagnosis.
- Show status, score, reason, latest log, ranking, map, and settings.

This was a rebuild, not a shallow refactor. The old single-file frontend and backend were replaced with modular structures.

## 2. Documentation Read

- `README.md`: preserved the Docker/Vite local development model and environment variable expectations.
- `docs/HANDOVER.md`: treated as the source of truth for current stack, Render deployment, API expectations, and known risks.
- `docs/PROJECT_MEMORY.md`: used for historical context, including old PostGIS and missed-train behavior.
- `docs/design.md`: used for mobile-first visual direction, sky motif, and old UI pain points.
- `ThinkWay.md`: reinforced the distinction between temporary map/current-location usage and persistent location logging.
- `.env.example`: used to align local configuration.
- `docker-compose.yml`: updated to match the new non-PostGIS architecture.

Decision note: older docs mention PostGIS, but the newer handover says the current deployment should be PostGIS-independent. The rebuild follows the handover and uses plain latitude/longitude columns.

## 3. Old Code Discarded

Discarded or replaced:

- Huge backend `backend/src/index.js` implementation.
- Huge frontend `frontend/src/main.js` implementation.
- Old Vite starter files `frontend/src/counter.js`, `frontend/src/javascript.svg`, and `frontend/src/style.css`.
- Old DOM-dependent page structure in `frontend/index.html`.
- Old combined `location_enabled` semantics as the main privacy model.
- Old duplicated ranking/scoring SQL logic.

Not preserved:

- Profile icon upload. It was deferred to keep the demo core stable and avoid DB bloat from Base64 image storage.
- Missed-train ranking. It is historical behavior but not central to the current mission.

## 4. Old Behavior Preserved

Preserved:

- SoraLog concept and naming.
- Email/password authentication.
- JWT-based protected API.
- PostgreSQL storage.
- OpenWeatherMap backend integration.
- Browser Geolocation API frontend flow.
- Leaflet + OpenStreetMap map.
- Weather score ranking.
- Sunny/rainy diagnosis and weather counts.
- Render-friendly Node/Express + Vite architecture.

## 5. New Backend Structure

```text
backend/src/
  app.js
  server.js
  index.js
  config/env.js
  db/pool.js
  db/init.js
  middleware/auth.js
  middleware/errorHandler.js
  middleware/validate.js
  routes/authRoutes.js
  routes/statusRoutes.js
  routes/locationRoutes.js
  routes/rankingRoutes.js
  routes/userRoutes.js
  routes/mapRoutes.js
  services/authService.js
  services/weatherService.js
  services/scoreService.js
  services/locationService.js
  services/statusService.js
  services/rankingService.js
  services/userService.js
  services/mapService.js
  repositories/userRepository.js
  repositories/locationRepository.js
  repositories/settingsRepository.js
  repositories/rankingRepository.js
  utils/apiResponse.js
  utils/asyncHandler.js
  utils/errors.js
```

Separation:

- Routes: HTTP wiring only.
- Services: auth, weather, scoring, privacy checks, ranking, map composition.
- Repositories: SQL only.
- Middleware: auth, validation, errors.
- `scoreService.js`: single source of truth for weather category, score delta, diagnosis title, and diagnosis reason.
- `db/init.js`: idempotent schema creation.

## 6. New Frontend Structure

```text
frontend/src/
  main.js
  app/constants.js
  app/router.js
  app/state.js
  api/client.js
  api/authApi.js
  api/statusApi.js
  api/locationApi.js
  api/rankingApi.js
  api/mapApi.js
  api/userApi.js
  features/auth/*
  features/home/*
  features/map/*
  features/ranking/*
  features/settings/*
  services/geolocationService.js
  ui/components.js
  ui/toast.js
  styles/base.css
  styles/layout.css
  styles/components.css
  styles/pages.css
```

The frontend is now a modular Vanilla JS SPA. Page modules render markup, controllers own events and data loading, API modules own backend calls, and `geolocationService.js` owns browser location handling.

## 7. API List

All successful responses use:

```json
{
  "success": true,
  "data": {}
}
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Endpoints:

- `GET /`
- `POST /register`
- `POST /login`
- `GET /user/info`
- `GET /status`
- `POST /log-location`
- `GET /ranking?type=weather&limit=50`
- `GET /users-locations`
- `GET /user/settings`
- `PUT /user/settings`

## 8. Database Schema

The rebuild uses plain PostgreSQL.

### `users`

- `id`
- `username`
- `email`
- `password_hash`
- `gender`
- `score`
- `created_at`
- `updated_at`

### `weather_logs`

- `id`
- `user_id`
- `latitude`
- `longitude`
- `weather_category`
- `weather_code`
- `city`
- `score_delta`
- `recorded_at`

### `user_settings`

- `id`
- `user_id`
- `location_logging_enabled`
- `location_visibility_enabled`
- `notification_enabled`
- `introduction_text`
- `created_at`
- `updated_at`

Indexes were added for latest weather logs and user settings lookup.

## 9. Location Privacy Design

Location controls are intentionally split:

- `location_logging_enabled`: whether pressing the record button may persist weather/location logs.
- `location_visibility_enabled`: whether the latest logged location may appear on the map.

Privacy behavior:

- The frontend does not start silent background tracking.
- Geolocation is requested by the browser only after the user presses the record button or opens map-related current-location behavior.
- Persistent logging is skipped when logging is disabled.
- Only users with visibility enabled appear in `/users-locations`.
- Other users' coordinates are rounded by `LOCATION_PUBLIC_PRECISION_DECIMALS`.
- The OpenWeatherMap key stays on the backend.
- `.env` remains ignored by git.

## 10. OpenWeatherMap Integration

`weatherService.js` calls OpenWeatherMap Current Weather API with latitude and longitude. It maps the returned weather code through `scoreService.js`.

If `WEATHER_API_KEY` is missing or still set to the placeholder value, `/log-location` returns:

```text
WEATHER_API_UNCONFIGURED
```

This is intentional so a demo does not silently create fake weather data.

## 11. Diagnosis and Score Logic

Weather categories:

- `sunny`
- `cloudy`
- `rainy`
- `snowy`
- `thunderstorm`
- `stormy`
- `unknown`

Score deltas:

- `sunny`: `+1`
- `cloudy`: `+0.5`
- `snowy`: `+1`
- `rainy`: `-1`
- `stormy`: `-2`
- `thunderstorm`: `-3`
- `unknown`: `0`

Snow is mildly positive because it is memorable and special, but not as universally positive as clear sun.

Diagnosis:

- `Sun Chaser` / `晴れタイプ`
- `Sunny Person` / `晴れタイプ`
- `Weather Neutral` / `空模様ミックス`
- `Rainy Person` / `雨タイプ`
- `Storm Bringer` / `嵐タイプ`

Gendered Japanese labels are not forced. The UI uses inclusive fallback labels.

## 12. UI Design Concept

The new frontend is a polished weather-themed entertainment app:

- Mobile-first app shell.
- Sky background and soft sun/cloud visual motifs.
- Friendly cards and rounded controls.
- Clear first-screen concept.
- Explicit "現在地の天気を記録" action.
- Loading, success, warning, and error states on major pages.
- Map and ranking screens designed for mobile and desktop.
- Settings page explains location logging versus map visibility.

## 13. How To Run Locally

Create `.env`:

```bash
cp .env.example .env
```

Set a real `WEATHER_API_KEY`.

Start backend and database:

```bash
docker compose up --build
```

Start frontend:

```bash
cd frontend
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:3000/`

## 14. Deployment Notes

Backend:

- Render Web Service
- Docker runtime
- Root directory: `backend`
- Start command from Dockerfile: `npm start`
- Required env: `DATABASE_URL`, `JWT_SECRET`, `WEATHER_API_KEY`

Frontend:

- Render Static Site
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Optional env: `VITE_API_BASE`

## 15. Verification Results

Static checks:

- `find backend/src -name '*.js' -print0 | xargs -0 -n1 node --check`: passed.
- `cd frontend && npm run build`: passed.

Runtime:

- `docker compose up -d --build`: passed.
- `docker compose ps`: API running, PostgreSQL healthy.
- `curl http://localhost:3000/`: HTTP 200.
- `curl http://localhost:5173/`: HTTP 200.

API smoke checks:

- `GET /`: passed.
- `POST /register`: passed.
- `POST /login`: passed.
- `GET /user/info`: passed.
- `GET /status`: passed.
- `GET /user/settings`: passed.
- `PUT /user/settings`: passed.
- `GET /ranking`: passed.
- `GET /users-locations`: passed.
- `POST /log-location`: route responded correctly but returned `503 WEATHER_API_UNCONFIGURED` because the local `.env` lacks a real OpenWeatherMap key.

Frontend:

- Production build passed.
- Dev server returned HTTP 200.
- In-app browser verification could not be completed because no browser target was available in this session.

## 16. Remaining Issues

- A real OpenWeatherMap API key is required to verify a successful saved weather log.
- Browser-based manual geolocation permission flows were not fully verified because the in-app browser was unavailable.
- JWT is still stored in `localStorage`; httpOnly cookies would be safer for production.
- No automated test suite was added.
- Profile icons were deferred.
- Historical missed-train behavior was intentionally not rebuilt.

## 17. Future Improvements

- Add API tests for auth, settings, status, ranking, and location logging with a mocked weather service.
- Add frontend interaction tests for auth, settings persistence, ranking, and geolocation denial states.
- Add a migration tool such as `node-pg-migrate`.
- Move JWT auth to httpOnly cookies.
- Add map visibility scopes such as private, friends, and public.
- Add weather history charts and trend explanations.
- Add profile icon support via object storage instead of Base64 in PostgreSQL.

## 18. Notes For The Next Developer Or Agent

- Keep `scoreService.js` as the single source of truth for weather diagnosis.
- Do not merge `location_logging_enabled` and `location_visibility_enabled`.
- Do not reintroduce automatic background location tracking without a very clear consent UX.
- Do not expose exact coordinates for other users.
- Do not add fake weather fallback data unless it is explicitly marked as demo-only and disabled in production.
- Keep route handlers thin; business logic belongs in services and SQL belongs in repositories.
