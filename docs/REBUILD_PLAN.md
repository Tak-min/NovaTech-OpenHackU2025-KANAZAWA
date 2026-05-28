# SoraLog Rebuild Plan

Created: 2026-05-28

## 1. Product Concept

SoraLog is a playful weather-and-location entertainment app. A user signs up, explicitly grants browser location access, and records the current weather at their location. The backend fetches current weather from OpenWeatherMap, stores consent-based weather/location logs, and calculates a fun diagnosis such as `Sunny Person`, `Rainy Person`, `Storm Bringer`, or Japanese labels such as `晴れタイプ` and `雨タイプ`.

The hackathon demo should make the idea obvious in the first few seconds:

- "Record my current weather" is the central action.
- The home screen shows the user's diagnosis, score, reason, and latest log.
- Ranking and map screens make the accumulated logs feel social.
- Settings make location logging and map visibility understandable and controllable.

## 2. Documentation Decisions

Documents read:

- `README.md`: local setup, Docker Compose flow, environment variables.
- `docs/HANDOVER.md`: latest source of truth for API, deployment, privacy notes, and known issues.
- `docs/PROJECT_MEMORY.md`: historical context, old PostGIS direction, scoring notes, and previous safety work.
- `docs/design.md`: visual direction, mobile-first app shell, sky/cloud motif, and old UI pain points.
- `ThinkWay.md`: decision log about separating map location from persistent logging.
- `.env.example`: environment variables and demo-friendly defaults.
- `docker-compose.yml`: local API and database service shape.

Conflict resolution:

- `docs/HANDOVER.md` says the current backend is PostGIS-independent and stores latitude/longitude columns directly. `docs/PROJECT_MEMORY.md` and `docker-compose.yml` still mention PostGIS. The rebuild will follow `docs/HANDOVER.md`: no PostGIS dependency in application code. Docker Compose may use plain PostgreSQL or keep the PostGIS image only as a compatible PostgreSQL image, but no app feature should require PostGIS.
- Older notes mention automatic periodic location sending. The rebuild will use an explicit button-driven recording flow for demo safety and clearer consent.
- Older settings use one `location_enabled` flag. The rebuild will split it into `location_logging_enabled` and `location_visibility_enabled` to avoid mixing storage consent with map visibility.

## 3. Required Features

Core backend features:

- Health check: `GET /`
- Authentication: `POST /register`, `POST /login`, `GET /user/info`
- Diagnosis/status: `GET /status`
- Location/weather logging: `POST /log-location`
- Ranking: `GET /ranking`
- Map users: `GET /users-locations`
- Settings: `GET /user/settings`, `PUT /user/settings`

Core frontend pages:

- Login/register
- Home/diagnosis
- Explicit weather recording flow
- Map
- Ranking
- Settings

Nice-to-have but not core:

- Profile icons. They can be skipped if they add risk; if skipped, the rebuild report will document why.
- Missed-train ranking. It is historical behavior, but not central to the latest rebuild request. Weather score ranking is required.

## 4. Existing Technical Problems

From the docs and current project history:

- Backend is concentrated in `backend/src/index.js`.
- Frontend is concentrated in `frontend/src/main.js`.
- API response formats are inconsistent.
- Input validation is distributed and hand-written.
- Weather score logic has existed in more than one place.
- Location logging consent and map visibility are not clearly separated.
- Automatic location sending is hard to explain in a demo.
- Other users' map coordinates can reveal too much if returned precisely.
- `alert()` and console logging are overused.
- DB schema creation is tied to application startup.
- JWT in `localStorage` is simple but has XSS risk.
- UI is charming but fragile on mobile/desktop boundaries.

## 5. New Architecture Proposal

### Backend

Use modular Express with clear ownership:

```text
backend/
  src/
    app.js
    server.js
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
    services/rankingService.js
    services/userService.js
    repositories/userRepository.js
    repositories/locationRepository.js
    repositories/settingsRepository.js
    utils/asyncHandler.js
```

Responsibilities:

- Routes only parse HTTP inputs and return responses.
- Middleware handles auth, validation, and errors.
- Services own business logic such as scoring, weather mapping, consent checks, and ranking composition.
- Repositories own SQL.
- `db/init.js` owns idempotent DDL.
- `scoreService.js` is the single source of truth for weather categories, score deltas, diagnosis title, and diagnosis reason.

### Frontend

Use a modular Vite SPA:

```text
frontend/
  src/
    main.js
    app/router.js
    app/state.js
    app/constants.js
    api/client.js
    api/authApi.js
    api/statusApi.js
    api/locationApi.js
    api/rankingApi.js
    api/userApi.js
    features/auth/authPage.js
    features/home/homePage.js
    features/home/homeController.js
    features/map/mapPage.js
    features/map/mapController.js
    features/ranking/rankingPage.js
    features/ranking/rankingController.js
    features/settings/settingsPage.js
    features/settings/settingsController.js
    services/geolocationService.js
    ui/toast.js
    ui/components.js
    styles/base.css
    styles/layout.css
    styles/components.css
    styles/pages.css
```

Responsibilities:

- API client centralizes base URL, JWT header, JSON parsing, and error handling.
- State stores token and current user only.
- Controllers coordinate API calls and page events.
- Page modules render markup and handle loading/empty/error states.
- Geolocation service wraps browser permission success/failure.
- Map controller owns Leaflet lifecycle and `invalidateSize`.

## 6. Data Model Proposal

Use PostgreSQL with idempotent table creation in `db/init.js`.

### `users`

- `id SERIAL PRIMARY KEY`
- `username VARCHAR(50) UNIQUE NOT NULL`
- `email VARCHAR(255) UNIQUE NOT NULL`
- `password_hash VARCHAR(255) NOT NULL`
- `gender VARCHAR(20) DEFAULT 'unspecified'`
- `score NUMERIC(10,2) DEFAULT 0`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

### `weather_logs`

- `id SERIAL PRIMARY KEY`
- `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `latitude DOUBLE PRECISION NOT NULL`
- `longitude DOUBLE PRECISION NOT NULL`
- `weather_category VARCHAR(30) NOT NULL`
- `weather_code INTEGER`
- `city VARCHAR(120)`
- `score_delta NUMERIC(10,2) NOT NULL DEFAULT 0`
- `recorded_at TIMESTAMPTZ DEFAULT NOW()`

### `user_settings`

- `id SERIAL PRIMARY KEY`
- `user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `location_logging_enabled BOOLEAN NOT NULL DEFAULT true`
- `location_visibility_enabled BOOLEAN NOT NULL DEFAULT false`
- `notification_enabled BOOLEAN NOT NULL DEFAULT true`
- `introduction_text TEXT DEFAULT ''`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

Indexes:

- `weather_logs(user_id, recorded_at DESC)`
- `weather_logs(recorded_at DESC)`
- `user_settings(user_id)`

Compatibility:

- If old tables named `locations` exist, the rebuild can create new `weather_logs` and leave old data untouched. A future migration can import old logs if needed.
- The rebuild does not require PostGIS.

## 7. API Contract Proposal

Response envelope:

```json
{
  "success": true,
  "data": {}
}
```

Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Latitude must be between -90 and 90."
  }
}
```

### `GET /`

Returns status, version, timestamp, and endpoint list.

### `POST /register`

Request:

```json
{
  "username": "sora",
  "email": "sora@example.com",
  "password": "password123",
  "gender": "unspecified"
}
```

Returns user summary and token so the user can enter the app immediately.

### `POST /login`

Request:

```json
{
  "email": "sora@example.com",
  "password": "password123"
}
```

Returns JWT and user summary.

### `GET /user/info`

Protected. Returns current user without password hash.

### `GET /status`

Protected. Returns:

- `diagnosisTitle`
- `diagnosisLabel`
- `score`
- `counts`
- `totalRecords`
- `positiveWeatherRate`
- `negativeWeatherRate`
- `reason`
- `latestLog`

### `POST /log-location`

Protected. Request:

```json
{
  "latitude": 36.5613,
  "longitude": 136.6562
}
```

Behavior:

- Validate coordinates.
- Check `location_logging_enabled`.
- Apply minimum interval from `LOG_LOCATION_MIN_INTERVAL_SECONDS`.
- Fetch weather from OpenWeatherMap.
- Convert weather code to app category.
- Store log only if consent and rate limit allow it.
- Update score from backend score service.

Returns saved/skipped result, weather category, score delta, city, updated status, and next allowed time if rate-limited.

### `GET /ranking?type=weather&limit=50`

Protected. Returns weather score ranking and current user's rank.

### `GET /users-locations`

Protected. Returns latest visible locations for users whose `location_visibility_enabled` is true. Current user's exact coordinates may be returned if they have a visible log. Other users' coordinates are rounded by `LOCATION_PUBLIC_PRECISION_DECIMALS`.

### `GET /user/settings`

Protected. Returns separated logging and visibility settings.

### `PUT /user/settings`

Protected. Updates:

- `location_logging_enabled`
- `location_visibility_enabled`
- `notification_enabled`
- `introduction_text`

## 8. Weather and Score Logic

OpenWeatherMap code mapping:

- `200-299`: `thunderstorm`
- `300-599`: `rainy`
- `600-699`: `snowy`
- `700-799`: `stormy`
- `800`: `sunny`
- `801-899`: `cloudy`
- other: `unknown`

Score deltas:

- `sunny`: `+1`
- `cloudy`: `+0.5`
- `snowy`: `+1`
- `rainy`: `-1`
- `stormy`: `-2`
- `thunderstorm`: `-3`
- `unknown`: `0`

Snow is treated as mildly positive because it is memorable and rare in many demo contexts, but less universally "good" than clear sun. The status reason will explicitly mention it as a special positive category.

Diagnosis thresholds:

- `score >= 20`: `Sun Chaser` / `晴れタイプ`
- `score >= 5`: `Sunny Person` / `晴れタイプ`
- `score <= -20`: `Storm Bringer` / `嵐タイプ`
- `score <= -5`: `Rainy Person` / `雨タイプ`
- otherwise: `Weather Neutral` / `空模様ミックス`

Use inclusive Japanese fallback labels. Do not force gendered labels unless the user selected a preference and the frontend chooses to display it.

## 9. Frontend Page Structure

### Login/Register

- SoraLog branding and short value proposition.
- Email/password login.
- Register with username, email, password, optional label preference.
- Form validation, loading state, double-submit prevention, and inline error feedback.

### Home

- Diagnosis title and Japanese label.
- Score and reason.
- Weather counts and latest log.
- Primary button: "Record my current weather".
- Navigation to map, ranking, and settings.
- Friendly permission/API error states.

### Recording Flow

1. User taps the record button.
2. Browser asks for geolocation permission.
3. Coordinates are sent to backend.
4. Backend fetches weather and checks consent/rate limit.
5. UI shows saved/skipped result and score change.

No silent background tracking.

### Map

- Leaflet map with OpenStreetMap tiles.
- Shows users who opted into visibility.
- Current user marker is visually distinct.
- Empty/error/loading states.
- Initializes once and calls `invalidateSize` on route activation.

### Ranking

- Weather score ranking.
- Current user highlight.
- Limit controlled by API.
- No duplicate calls on tab/page activation.
- Mobile cards and desktop-friendly layout.

### Settings

- Separate toggles for persistent logging and map visibility.
- Clear helper text for both.
- Notification toggle and introduction text.
- Save state and reload persistence.

## 10. Privacy and Location Policy

- Browser geolocation is requested only after explicit user action.
- Temporary use of current location and persistent logging are separate concepts.
- `location_logging_enabled` controls whether logs are stored.
- `location_visibility_enabled` controls whether latest logged location can appear on the map.
- Other users' map coordinates are rounded before returning to clients.
- Precise coordinates are not written to console logs.
- OpenWeatherMap API key remains backend-only.
- `.env` is never committed.
- JWT stays in `localStorage` for this rebuild because it matches the existing deployment-friendly stack, but the report will call out httpOnly cookies as a future improvement.

## 11. Implementation Order

1. Read docs and create this plan.
2. Define backend architecture.
3. Define database schema/init strategy.
4. Implement backend config and DB connection.
5. Implement backend health check.
6. Implement auth.
7. Implement weather service and score service.
8. Implement location logging.
9. Implement status/diagnosis.
10. Implement settings.
11. Implement ranking.
12. Implement map endpoint.
13. Rebuild frontend app shell.
14. Rebuild auth pages.
15. Rebuild home/diagnosis flow.
16. Rebuild map page.
17. Rebuild ranking page.
18. Rebuild settings page.
19. Polish UI/UX.
20. Run verification.
21. Create `docs/REBUILD_REPORT.md`.

## 12. Feedforward Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Rebuilding too much and losing the core product | Keep the first demo path focused: register, login, record weather, show diagnosis. |
| Beautiful UI but broken integration | Implement backend endpoints and frontend API modules before visual polish. |
| Mixing location logging and map visibility | Use separate settings fields and separate frontend copy. |
| Exposing precise user locations | Return exact coordinates only for current user where appropriate; round other users' coordinates. |
| Duplicating scoring logic | Keep weather mapping, score delta, diagnosis title, and reason in `scoreService.js` only. |
| Inconsistent API responses | Use a shared success/error response pattern and central error handler. |
| Loading/error states missing | Every page module renders loading, empty, and error states before feature polish. |
| Reintroducing giant files | Create route/service/repository and page/controller modules from the beginning. |
| Breaking Render deployment | Preserve Node/Express/Vite/PostgreSQL stack, Dockerfile start command, and `VITE_API_BASE` behavior. |
| Forgetting `.env.example` | Update env docs while implementing backend config. |
| Hard-to-demo behavior | Use explicit "Record my current weather" action and low local rate limit default. |
| OpenWeatherMap unavailable during demo | Return friendly API error; keep the rest of the app usable. |
| Existing database has old tables | Create new idempotent tables without destructive migration. |
| JWT localStorage risk | Avoid injecting unsanitized HTML and document httpOnly cookie migration as future work. |
| Profile icon feature destabilizes core app | Skip or defer icons unless core flows are complete and verified. |

## 13. Verification Plan

Static checks:

- `node --check backend/src/**/*.js` or equivalent file-by-file check.
- `cd frontend && npm run build`.

API checks:

- `GET /`
- `POST /register`
- `POST /login`
- `GET /user/info`
- `GET /status`
- `POST /log-location`
- `GET /ranking`
- `GET /users-locations`
- `GET /user/settings`
- `PUT /user/settings`

Manual flow checks:

- Logged-out app.
- Register.
- Logout/login.
- Authentication restoration after reload.
- Record weather with allowed geolocation.
- Friendly fallback for denied geolocation.
- Ranking.
- Map.
- Settings persistence.
- Mobile and desktop layouts.
