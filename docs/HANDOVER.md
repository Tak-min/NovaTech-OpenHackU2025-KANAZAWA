# SoraLog 引き継ぎ書

最終更新日: 2026-05-22
対象リポジトリ: `Tak-min/NovaTech-OpenHackU2025-KANAZAWA`
対象ブランチ: `main`

## 1. この文書の目的

この文書は、SoraLog プロジェクトを次の開発者へ引き継ぐための技術資料である。
プロジェクトの概要、構成、API仕様、開発手順、Renderデプロイ、既知の課題、直近の変更履歴をまとめる。

機密情報はこの文書に記載しない。Render、DB、OpenWeatherMap、JWTなどの秘密値はRender管理画面または各自の `.env` で管理すること。

## 2. プロジェクト概要

SoraLog は、ユーザーの位置情報とその地点の天気を記録し、蓄積した天気ログから「晴れ男」「雨女」などのジンクスを可視化するWebアプリである。

主な体験は以下。

- ユーザー登録・ログイン
- 位置情報許可に基づく現在地の記録
- 現在地の天気取得
- 天気履歴に基づく称号判定
- 天気スコアランキング
- 地図上でのユーザー位置表示
- プロフィールアイコン・自己紹介・設定保存

当初はOpenHackU向けのハッカソン作品として作成された。現在は技育博への展示を意識し、Render上での安定動作、プライバシー、運用性、説明力を改善している。

## 3. システム構成

```text
Browser
  |
  | Vite frontend
  v
Render Static Site: soralog
  |
  | fetch API
  v
Render Web Service: soralog-backend
  |
  | pg
  v
Render PostgreSQL: SoralogDataBase
  |
  | axios
  v
OpenWeatherMap API
```

### 公開URL

| 種別 | URL | 状態 |
|---|---|---|
| フロントエンド | `https://soralog-qnka.onrender.com/` | 2026-05-22時点でHTTP 200確認済み |
| バックエンド | `https://soralog-backend.onrender.com/` | 2026-05-22時点でHTTP 200確認済み |

## 4. 技術スタック

### フロントエンド

- Vite
- Vanilla JavaScript
- CSS
- Leaflet
- OpenStreetMap tiles
- Browser Geolocation API
- `localStorage` にJWTを保存

### バックエンド

- Node.js 20
- Express
- PostgreSQL接続: `pg`
- 外部API: `axios`
- 認証: `jsonwebtoken`
- パスワードハッシュ: `bcrypt`
- CORS: `cors`
- 環境変数: `dotenv`

### データベース

- PostgreSQL
- 現在はPostGIS非依存
- 位置情報は `locations.latitude` / `locations.longitude` に保存

### ホスティング

- Render Static Site: frontend
- Render Web Service: backend
- Render PostgreSQL: database

## 5. ディレクトリ構成

```text
.
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── backend
│   ├── Dockerfile
│   ├── package.json
│   └── src
│       └── index.js
├── frontend
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── public
│   │   └── img
│   └── src
│       ├── main.js
│       └── style.css
└── docs
    ├── PROJECT_MEMORY.md
    └── HANDOVER.md
```

## 6. 重要ファイル

| ファイル | 役割 |
|---|---|
| `backend/src/index.js` | Express API、DB初期化、認証、位置・天気記録、ランキング処理 |
| `backend/Dockerfile` | Render Web Service用のDocker定義 |
| `frontend/src/main.js` | 画面制御、API通信、位置情報送信、地図、ランキング、設定 |
| `frontend/src/style.css` | アプリ全体のCSS |
| `frontend/index.html` | 画面構造 |
| `.env.example` | ローカル環境変数の雛形 |
| `docs/PROJECT_MEMORY.md` | 開発経緯・作業メモ |
| `docs/HANDOVER.md` | 本引き継ぎ書 |

## 7. 環境変数

`.env.example` をコピーして `.env` を作成する。

```bash
cp .env.example .env
```

Windows PowerShellでは以下。

```powershell
Copy-Item .env.example .env
```

### バックエンド必須

| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL接続URL |
| `JWT_SECRET` | JWT署名用の秘密鍵 |
| `WEATHER_API_KEY` | OpenWeatherMap APIキー |
| `NODE_ENV` | `development` または `production` |
| `PORT` | バックエンド起動ポート。RenderではRender側が設定する |

### DB関連

| 変数 | 用途 |
|---|---|
| `POSTGRES_USER` | Docker Compose用DBユーザー |
| `POSTGRES_PASSWORD` | Docker Compose用DBパスワード |
| `POSTGRES_DB` | Docker Compose用DB名 |

### 運用設定

| 変数 | 既定値 | 用途 |
|---|---:|---|
| `LOG_LOCATION_MIN_INTERVAL_SECONDS` | `300` | 同一ユーザーの位置情報記録を抑制する秒数 |
| `LOCATION_PUBLIC_PRECISION_DECIMALS` | `3` | 他ユーザーに返す座標の丸め桁数 |
| `FRONTEND_ORIGINS` | 空 | CORS許可Originの追加指定 |

### フロントエンド任意

| 変数 | 用途 |
|---|---|
| `VITE_API_BASE` | APIベースURLの上書き。未設定時は本番API、localhost時はローカルAPIを使う |

## 8. ローカル開発手順

### バックエンドとDB

プロジェクトルートで実行する。

```powershell
docker compose up --build
```

バックエンドは `http://localhost:3000/` で起動する。

確認:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/
```

### フロントエンド

別ターミナルで実行する。

```powershell
cd frontend
npm install
npm run dev
```

通常は `http://localhost:5173/` で起動する。

### よく使う検証コマンド

```powershell
node --check backend/src/index.js
node --check frontend/src/main.js
cd frontend
npm run build
```

## 9. Render デプロイ構成

### Backend Web Service

想定設定:

| 項目 | 値 |
|---|---|
| Service name | `soralog-backend` |
| Runtime | Docker |
| Root directory | `backend` |
| Dockerfile | `backend/Dockerfile` |
| Branch | `main` |
| Start command | Dockerfileの `CMD ["npm", "start"]` |

`backend/Dockerfile` は本番で `npm start` を実行する。
`npm run dev` は `nodemon` が必要であり、本番環境では起動失敗の原因になるため使用しない。

### Frontend Static Site

想定設定:

| 項目 | 値 |
|---|---|
| Service name | `soralog` |
| Root directory | `frontend` |
| Build command | `npm install && npm run build` |
| Publish directory | `frontend/dist` または root directory基準の `dist` |
| Branch | `main` |

### Database

Render PostgreSQLを使用する。
バックエンドはRender内部接続用の `DATABASE_URL` を使う。
外部接続URLやパスワードは文書化しない。

## 10. Render デプロイ確認手順

1. ローカルでビルド・構文チェックを通す。

```powershell
node --check backend/src/index.js
node --check frontend/src/main.js
cd frontend
npm run build
```

2. GitHubへpushする。

```powershell
git status --short --branch
git add .
git commit -m "変更内容を短く記述"
git push origin main
```

3. Renderの自動デプロイ完了を待つ。

4. 公開URLを確認する。

```powershell
Invoke-WebRequest -UseBasicParsing https://soralog-backend.onrender.com/
Invoke-WebRequest -UseBasicParsing https://soralog-qnka.onrender.com/
```

5. バックエンドが応答しない場合はRender Dashboardで以下を確認する。

- Build log
- Deploy log
- Runtime log
- Environment variables
- `DATABASE_URL`
- `WEATHER_API_KEY`
- `JWT_SECRET`
- Web ServiceのRoot directory
- Dockerfile path
- PostgreSQLがActiveか

## 11. API仕様

APIベースURL:

- 本番: `https://soralog-backend.onrender.com`
- ローカル: `http://localhost:3000`

認証が必要なAPIは以下ヘッダーを付与する。

```http
Authorization: Bearer <JWT>
```

### GET /

ヘルスチェック。

認証: 不要

レスポンス例:

```json
{
  "message": "SoraLog API Server is running",
  "version": "1.0.0",
  "endpoints": {
    "auth": ["POST /register", "POST /login", "GET /status"],
    "location": ["POST /log-location"],
    "ranking": ["GET /ranking"],
    "map": ["GET /users-locations"]
  },
  "timestamp": "2026-05-22T00:00:00.000Z"
}
```

`NODE_ENV !== production` の場合のみ `debug` が含まれる。

### POST /register

ユーザー登録。

認証: 不要

リクエスト:

```json
{
  "username": "user01",
  "email": "user@example.com",
  "password": "password123",
  "gender": "male"
}
```

`gender` は `male`, `female`, `other` を想定する。
フロントのUIでは主に `male` / `female` を使っている。

成功レスポンス:

```json
{
  "message": "ユーザー登録が成功しました",
  "user": {
    "id": 1,
    "username": "user01"
  }
}
```

主なエラー:

| Status | 内容 |
|---:|---|
| 400 | 入力不足、メール形式不正、パスワード短すぎ、gender不正 |
| 409 | メールアドレスまたはユーザー名が重複 |
| 500 | サーバーエラー |

### POST /login

ログインしてJWTを取得する。

認証: 不要

リクエスト:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

成功レスポンス:

```json
{
  "message": "ログインに成功しました",
  "token": "<JWT>"
}
```

JWT有効期限は1時間。

### GET /status

現在ユーザーの称号、スコア、天気別回数、乗り遅れ回数を取得する。

認証: 必要

成功レスポンス:

```json
{
  "status": "晴れ男",
  "score": 120,
  "counts": {
    "sunny": 100,
    "rainy": 10
  },
  "missedTrainCount": 2,
  "stats": {
    "totalRecords": 110,
    "positiveWeatherCount": 100,
    "negativeWeatherCount": 10,
    "positiveRate": 90.9,
    "negativeRate": 9.1
  },
  "statusReason": "110件の天気ログから判定中。晴れ・くもり・雪寄りが90.9%、雨・荒天寄りが9.1%です"
}
```

### POST /log-location

ユーザーの位置情報を記録し、OpenWeatherMapから天気を取得してスコアを更新する。

認証: 必要

リクエスト:

```json
{
  "latitude": 36.57806,
  "longitude": 136.64789
}
```

処理内容:

1. 緯度経度の形式と範囲を検証する。
2. 同一ユーザーの直近記録から `LOG_LOCATION_MIN_INTERVAL_SECONDS` 以内なら保存をスキップする。
3. 駅座標との距離をHaversine式で計算し、半径70m以内なら乗り遅れ回数を更新する。
4. OpenWeatherMapから現在天気を取得する。
5. `locations` に緯度・経度・天気カテゴリを保存する。
6. `users.score` を更新する。

成功レスポンス:

```json
{
  "message": "位置情報を記録しました",
  "weather": "sunny",
  "city": "Kanazawa",
  "scoreChange": 1
}
```

記録間隔内レスポンス:

```json
{
  "message": "位置情報の記録間隔内のためスキップしました",
  "skipped": true,
  "reason": "rate_limited",
  "nextAllowedAt": "2026-05-22T00:05:00.000Z"
}
```

### GET /ranking

ランキングを取得する。

認証: 必要

クエリ:

| パラメータ | 値 |
|---|---|
| `type` | `weather`, `missed`, `delay` |
| `limit` | 1から100。未指定時50 |

例:

```http
GET /ranking?type=weather&limit=50
```

レスポンス:

```json
{
  "type": "weather",
  "rankings": [
    {
      "rank": 1,
      "id": 1,
      "username": "user01",
      "score": 10,
      "isCurrentUser": true
    }
  ],
  "currentUserRank": null,
  "totalUsers": 1
}
```

### GET /users-locations

地図表示用に、位置情報公開が有効なユーザーの最新位置を取得する。

認証: 必要

仕様:

- `user_settings.location_enabled = true` のユーザーのみ対象
- 自分の座標はそのまま返す
- 他ユーザーの座標は `LOCATION_PUBLIC_PRECISION_DECIMALS` で丸める

レスポンス:

```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "user01",
      "latitude": 36.578,
      "longitude": 136.648,
      "weather": "sunny",
      "recordedAt": "2026-05-22T00:00:00.000Z",
      "status": "晴れ男",
      "score": 10,
      "isCurrentUser": true
    }
  ]
}
```

### GET /user/settings

ユーザー設定を取得する。

認証: 必要

レスポンス:

```json
{
  "notification_enabled": true,
  "location_enabled": false,
  "introduction_text": ""
}
```

### PUT /user/settings

ユーザー設定を保存する。

認証: 必要

リクエスト:

```json
{
  "notification_enabled": true,
  "location_enabled": true,
  "introduction_text": "よろしくお願いします"
}
```

### POST /user/icon

プロフィールアイコンを保存する。

認証: 必要

リクエスト:

```json
{
  "icon_data": "<base64 body>",
  "content_type": "image/jpeg",
  "file_size": 12345
}
```

現在は画像をDBにBase64テキストとして保存する。
本格運用ではオブジェクトストレージへ移すことを推奨する。

### GET /user/icon

プロフィールアイコンを取得する。

認証: 必要

保存済みの場合は画像バイナリを返す。未設定の場合は `204 No Content`。

### GET /user/info

ログインユーザーの基本情報を取得する。

認証: 必要

レスポンス:

```json
{
  "id": 1,
  "username": "user01",
  "email": "user@example.com",
  "gender": "male"
}
```

### GET /debug/users

開発環境のみ有効。

条件:

```text
NODE_ENV !== production
```

本番では登録されない。

## 12. DBスキーマ

DBマイグレーションツールは未導入。
現在はバックエンド起動時に `createTables()` が `CREATE TABLE IF NOT EXISTS` と `ALTER TABLE` を実行する。

### users

| カラム | 型 | 用途 |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | ユーザーID |
| `username` | `VARCHAR(50) UNIQUE NOT NULL` | ユーザー名 |
| `email` | `VARCHAR(255) UNIQUE NOT NULL` | メールアドレス |
| `password_hash` | `VARCHAR(255) NOT NULL` | bcryptハッシュ |
| `gender` | `VARCHAR(10)` | `male`, `female`, `other` |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | 作成日時 |
| `missed_train_count` | `INTEGER DEFAULT 0` | 乗り遅れ回数 |
| `last_missed_train_at` | `TIMESTAMP WITH TIME ZONE` | 最後に乗り遅れ加算した日時 |
| `score` | `NUMERIC(10,2) DEFAULT 0` | 累積天気スコア |

### locations

| カラム | 型 | 用途 |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | ログID |
| `user_id` | `INTEGER REFERENCES users(id)` | ユーザーID |
| `latitude` | `DOUBLE PRECISION` | 緯度 |
| `longitude` | `DOUBLE PRECISION` | 経度 |
| `weather` | `VARCHAR(50)` | 天気カテゴリ |
| `recorded_at` | `TIMESTAMP WITH TIME ZONE` | 記録日時 |

過去に `geom` カラムを使っていた可能性があるため、起動時に `geom` の `NOT NULL` を外す処理が入っている。

### user_settings

| カラム | 型 | 用途 |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | 設定ID |
| `user_id` | `INTEGER UNIQUE REFERENCES users(id)` | ユーザーID |
| `notification_enabled` | `BOOLEAN DEFAULT true` | 通知設定 |
| `location_enabled` | `BOOLEAN DEFAULT false` | 地図公開・位置送信設定 |
| `introduction_text` | `TEXT` | 自己紹介 |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | 作成日時 |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | 更新日時 |

### user_icons

| カラム | 型 | 用途 |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | アイコンID |
| `user_id` | `INTEGER UNIQUE REFERENCES users(id)` | ユーザーID |
| `icon_data` | `TEXT NOT NULL` | Base64画像データ |
| `content_type` | `VARCHAR(50)` | MIME type |
| `file_size` | `INTEGER` | ファイルサイズ |
| `uploaded_at` | `TIMESTAMP WITH TIME ZONE` | アップロード日時 |

## 13. 天気カテゴリとスコア

OpenWeatherMapのweather codeを以下に分類する。

| OpenWeatherMap code | アプリ内カテゴリ |
|---|---|
| 200-299 | `thunderstorm` |
| 300-599 | `rainy` |
| 600-699 | `snowy` |
| 700-799 | `stormy` |
| 800 | `sunny` |
| 801以上 | `cloudy` |
| その他 | `unknown` |

スコア:

| カテゴリ | スコア |
|---|---:|
| `sunny` | `+1` |
| `cloudy` | `+0.5` |
| `rainy` | `-1` |
| `snowy` | `+2` |
| `thunderstorm` | `-3` |
| `stormy` | `-2` |
| `unknown` | `0` |

## 14. 称号判定

現在の称号判定は累積スコアベース。

| 条件 | 称号 |
|---|---|
| `score > 500` | `太陽神` |
| `score > 100` かつ `gender === female` | `晴れ女` |
| `score > 100` かつそれ以外 | `晴れ男` |
| `score < -500` | `嵐を呼ぶ者` |
| `score < -100` かつ `gender === female` | `雨女` |
| `score < -100` かつそれ以外 | `雨男` |
| その他 | `凡人` |

補足:

- `statusReason` は記録数、晴れ・くもり・雪寄り比率、雨・荒天寄り比率から生成する。
- 今後は累積スコアだけでなく、地域平均や記録回数補正を加えた判定へ拡張する余地がある。

## 15. 位置情報とプライバシー

現在の仕様:

- フロントはブラウザGeolocation APIで位置を取得する。
- 設定で `location_enabled` が有効な場合に位置情報送信を行う。
- 開発環境では10秒ごと、本番ビルドでは5分ごとに送信する。
- バックエンドでも `LOG_LOCATION_MIN_INTERVAL_SECONDS` により短時間の重複保存を防ぐ。
- 他ユーザーの地図表示座標は丸めて返す。

注意:

- 正確な位置情報を扱うため、展示や公開時は同意説明を明確にする。
- 今後は「自分のみ」「グループのみ」「公開」などの公開範囲設定を追加することが望ましい。

## 16. フロントエンド仕様

主な画面:

| 画面 | 内容 |
|---|---|
| ログイン | メール・パスワードでログイン |
| 新規登録 | ユーザー名、メール、パスワード、性別 |
| ホーム | 称号、理由、画像、スコアゲージ、乗り遅れ回数 |
| マップ | Leafletでユーザー最新位置を表示 |
| ランキング | 天気スコア、乗り遅れ回数 |
| 設定 | アイコン、自己紹介、通知設定、位置情報許可 |

APIベースURLの決定:

1. `window.__API_BASE__` があれば使用
2. localhostの場合は `http://localhost:3000`
3. `import.meta.env.VITE_API_BASE` があれば上書き
4. それ以外は `https://soralog-backend.onrender.com`

## 17. 直近の開発履歴

### `78dc83b Prepare Render deployment and production safety`

- `.env.example` 追加
- `.gitignore` 追加
- `docs/PROJECT_MEMORY.md` 追加
- README更新
- `/debug/users` を本番無効化
- 位置情報記録間隔を追加
- 他ユーザー座標丸めを追加
- フロントの旧ダミーscriptを撤去
- inline styleの一部をCSSへ移動
- API入力検証を強化

### `606df9e Remove PostGIS dependency for Render backend`

- PostGIS依存を削除
- `locations.latitude` / `locations.longitude` 保存へ変更
- 駅距離計算をNode.jsのHaversine計算へ変更
- `/users-locations` を通常カラム参照へ変更

### `a21a24d Use production start command in backend Dockerfile`

- `backend/Dockerfile` の起動コマンドを `npm run dev` から `npm start` へ変更
- Render本番で `nodemon` が無くても起動できるようにした

## 18. 現在の動作確認状況

2026-05-22時点。

### ローカル検証

以下は成功済み。

```powershell
node --check backend/src/index.js
node --check frontend/src/main.js
cd frontend
npm run build
```

### Render公開URL

以下はHTTP 200確認済み。

```text
https://soralog-backend.onrender.com/
https://soralog-qnka.onrender.com/
```

バックエンドは一時的にタイムアウトしていた。
主な対応としてPostGIS非依存化とDockerfileの本番起動コマンド修正を行い、その後HTTP 200を確認した。

## 19. 既知の課題

### 優先度 高

- `backend/src/index.js` が単一ファイルで大きい。routes、services、repositoriesへ分割する。
- `frontend/src/main.js` が単一ファイルで大きい。api、auth、location、ranking、map、settingsへ分割する。
- JWTを `localStorage` に保存しているため、XSS対策が弱い。
- DBマイグレーションツールが未導入。
- `user_icons.icon_data` に画像Base64を保存しているため、DBが肥大化しやすい。
- 位置情報の公開同意・公開範囲設定が不足している。

### 優先度 中

- 本番でもフロント側 `console.log` が多い。
- `alert()` ベースのエラー表示が多い。
- APIレスポンス形式が統一されていない。
- 入力バリデーションが手書きで分散している。
- ランキングのスコア計算SQLと `WEATHER_SCORE_MAP` が重複している。

### 優先度 低

- 使っていない画像や重複画像が `frontend/public/img` に残っている。
- Tailwind依存があるが、実装は通常CSS中心。
- READMEはセットアップ中心で、詳細仕様は本書に分離されている。

## 20. 次の推奨作業

1. バックエンドを分割する。
   - `routes/auth.js`
   - `routes/location.js`
   - `routes/ranking.js`
   - `routes/user.js`
   - `services/weatherService.js`
   - `services/scoreService.js`
   - `services/locationService.js`
   - `db/pool.js`

2. フロントエンドを分割する。
   - `api/client.js`
   - `features/auth.js`
   - `features/home.js`
   - `features/map.js`
   - `features/ranking.js`
   - `features/settings.js`
   - `features/locationTracking.js`

3. DBマイグレーションを導入する。
   - `node-pg-migrate` などを検討
   - 起動時DDLから段階的に移行

4. 認証方式を改善する。
   - httpOnly Cookie化
   - CSRF対策
   - refresh token検討

5. 位置情報公開設定を拡張する。
   - 非公開
   - 自分のみ
   - ランキング参加のみ
   - 地図公開

6. 展示用ダッシュボードを作る。
   - 記録件数
   - 晴れ率
   - 雨率
   - 称号理由
   - 地域別傾向

## 21. 障害対応メモ

### バックエンドがRenderでタイムアウトする

確認順:

1. RenderのRuntime Logを見る。
2. `DATABASE_URL` が設定されているか確認。
3. `WEATHER_API_KEY` が設定されているか確認。
4. `JWT_SECRET` が設定されているか確認。
5. Dockerfileが `CMD ["npm", "start"]` になっているか確認。
6. Service root directory が `backend` になっているか確認。
7. `PORT` を固定していないか確認。
8. DBがActiveか確認。

### フロントがAPIへ接続できない

確認順:

1. ブラウザDevToolsのNetworkを見る。
2. API URLが `https://soralog-backend.onrender.com` か確認。
3. CORSで弾かれていないか確認。
4. `FRONTEND_ORIGINS` にフロントURLを追加する。
5. ログイン後のJWTが `localStorage` にあるか確認。

### 位置情報が保存されない

確認順:

1. ブラウザで位置情報許可がONか確認。
2. アプリ設定の `location_enabled` がONか確認。
3. `LOG_LOCATION_MIN_INTERVAL_SECONDS` によりスキップされていないか確認。
4. `/log-location` のレスポンスを見る。
5. OpenWeatherMap API keyが有効か確認。

## 22. 機密情報の扱い

以下はコミット禁止。

- `.env`
- Render DB接続URL
- Render API key
- OpenWeatherMap API key
- JWT secret
- DB password
- 個人情報を含むdocxやメモ

`.gitignore` では `.env` と機密docxを除外している。
ただし、手元で新しい機密ファイルを作成した場合は都度 `.gitignore` を確認すること。

## 23. 引き継ぎ時の最低確認リスト

新しい開発者は、最初に以下を確認する。

- [ ] `docs/HANDOVER.md` を読む
- [ ] `docs/PROJECT_MEMORY.md` を読む
- [ ] `.env.example` から `.env` を作る
- [ ] `docker compose up --build` でローカルAPIを起動する
- [ ] `frontend` で `npm install` / `npm run dev` を実行する
- [ ] `node --check backend/src/index.js` を実行する
- [ ] `node --check frontend/src/main.js` を実行する
- [ ] `npm run build` を実行する
- [ ] Renderの環境変数を確認する
- [ ] Render公開URLがHTTP 200を返すことを確認する
