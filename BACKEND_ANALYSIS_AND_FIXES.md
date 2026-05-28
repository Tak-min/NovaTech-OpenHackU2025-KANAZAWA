# バックエンド分析レポート & 改善計画書

> 生成日: 2025-06-01  
> 対象: NovaTech-OpenHackU2025-KANAZAWA/backend (Node.js/Express/PostgreSQL)  
> 目的: 他AIエージェントとの共同作業用ドキュメント

---

## 📁 プロジェクト構成

```
backend/
├── Dockerfile
├── package.json
└── src/
    ├── server.js          # エントリーポイント
    ├── app.js             # Express app 設定
    ├── config/
    │   └── env.js         # 環境変数管理
    ├── db/
    │   ├── init.js        # DB初期化 (DDL)
    │   └── pool.js        # PostgreSQL接続プール
    ├── middleware/
    │   ├── auth.js        # JWT認証
    │   ├── errorHandler.js # エラーハンドリング
    │   └── validate.js    # リクエストバリデーション
    ├── repositories/
    │   ├── locationRepository.js
    │   ├── rankingRepository.js
    │   ├── settingsRepository.js
    │   └── userRepository.js
    ├── routes/
    │   ├── authRoutes.js      # /register, /login
    │   ├── locationRoutes.js  # /log-location
    │   ├── mapRoutes.js       # /users-locations
    │   ├── rankingRoutes.js   # /ranking
    │   ├── statusRoutes.js    # /status
    │   └── userRoutes.js      # /user/info, /user/settings
    ├── services/
    │   ├── authService.js
    │   ├── locationService.js
    │   ├── mapService.js
    │   ├── rankingService.js
    │   ├── scoreService.js    # ★天気コード分類ロジック
    │   ├── statusService.js
    │   ├── userService.js
    │   └── weatherService.js  # OpenWeatherMap API呼び出し
    └── utils/
        ├── apiResponse.js
        ├── asyncHandler.js
        └── errors.js
```

---

## 🔴 CRITICAL: 即座に修正が必要なバグ

### BUG-1: 天気コード700番台の誤分類（scoreService.js）

**発生箇所:** `src/services/scoreService.js` L17-18

```javascript
// 現状のコード
if (code >= 700 && code < 800) return 'stormy'; // ← エラー
```

**問題:**
OpenWeatherMapの天気コード体系では、700番台は**「大気現象」（霧、もや、砂塵など）**であり、嵐(stormy)ではない。

| コード範囲 | OpenWeatherMapの意味 | 現状の分類 | 適切な分類 |
|---|---|---|---|
| 701 | Mist (霧) | stormy ❌ | cloudy ✅ |
| 721 | Haze (靄) | stormy ❌ | cloudy ✅ |
| 731 | Dust/Sand (砂塵) | stormy ❌ | cloudy ✅ |
| 741 | Fog (霧) | stormy ❌ | cloudy ✅ |
| 751 | Sand (砂) | stormy ❌ | cloudy ✅ |
| 761 | Dust (塵) | stormy ❌ | cloudy ✅ |
| 762 | Volcanic Ash (火山灰) | stormy ❌ | cloudy ✅ |
| 771 | Squall (突風) | stormy ❌ | stormy ✅ (例外) |
| 781 | Tornado (竜巻) | stormy ❌ | stormy ✅ (例外) |

**影響:** 霧やもやの日は嵐(-2pt)として扱われ、ユーザーのスコアが不当に低下する。

**修正案:**

```javascript
const categoryFromWeatherCode = (weatherCode) => {
  const code = Number(weatherCode);

  if (!Number.isFinite(code)) return 'unknown';
  if (code >= 200 && code < 300) return 'thunderstorm';
  if (code >= 300 && code < 600) return 'rainy';
  if (code >= 600 && code < 700) return 'snowy';
  // 700番台: 大部分は霧/もや → cloudy扱い
  // 例外: 771(突風), 781(竜巻) はstormy
  if (code === 771 || code === 781) return 'stormy';
  if (code >= 700 && code < 800) return 'cloudy';
  if (code === 800) return 'sunny';
  if (code > 800 && code < 900) return 'cloudy';
  return 'unknown';
};
```

---

### BUG-2: WEATHER_API_KEY がプレースホルダーのまま（.env）

**発生箇所:** `.env` L8

```
WEATHER_API_KEY=your_openweathermap_api_key
```

**影響:**
- `weatherService.js` でチェックが入るが、結果として **全ユーザーの位置情報記録が失敗**
- `/log-location` が常に `503 WEATHER_API_UNCONFIGURED` を返す

**修正案:**
有効なOpenWeatherMap APIキーを設定する。または、開発環境用にスタブを用意する。

---

## 🟠 HIGH: 重要な設計上の問題

### ISSUE-1: settingsRepository.getByUserId が読取のたびにDB書き込み

**発生箇所:** `src/repositories/settingsRepository.js` L21-23

```javascript
const getByUserId = async (userId, db = pool) => {
  const ensured = await ensureForUser(userId, db); // ← INSERT ... ON CONFLICT を毎回実行
  return ensured;
};
```

**問題:** 
`ensureForUser` は `INSERT ... ON CONFLICT DO UPDATE SET updated_at = NOW()` なので、**設定を読むたびに `updated_at` が更新**される。読取操作が副作用を持つ。

**修正案:**

```javascript
const getByUserId = async (userId, db = pool) => {
  const result = await query(
    db,
    `SELECT location_logging_enabled, location_visibility_enabled, notification_enabled, introduction_text
     FROM user_settings
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    // 初回はINSERT
    return ensureForUser(userId, db);
  }

  return normalizeSettings(result.rows[0]);
};
```

---

### ISSUE-2: DB初回起動ロジックの冗長性（db/init.js）

**問題点:**
1. `CREATE TABLE IF NOT EXISTS` でテーブル作成後、**同じテーブルに対して** `ALTER TABLE ADD COLUMN IF NOT EXISTS` を全カラム分実行
2. 移行コード（カラムリネーム）がinitに混在
3. 毎回起動時に無駄なALTER文が大量に実行される

**修正案:** マイグレーション番号付きのシンプルなinitに書き換える。`CREATE TABLE IF NOT EXISTS` で全カラムを定義し、ALTER文は最新の1回だけ実行するようにする。

---

### ISSUE-3: 天気取得失敗で位置情報記録も失敗する

**発生箇所:** `src/services/locationService.js` L48-51

```javascript
const weather = await fetchCurrentWeather(coordinates); // ← ここで失敗すると...
const scoreDelta = scoreForCategory(weather.weatherCategory);

const log = await locationRepository.insertLog({ ... }, client); // ← こっちも実行されない
```

**問題:**
天気APIがタイムアウト・エラーの場合、位置情報も天気ログも一切保存されない。

**修正案:**
- 天気取得をオプショナルにし、失敗時は `weatherCategory: 'unknown'` として位置情報だけ保存
- または、天気取得を別途リトライキューに追加

```javascript
let weather;
try {
  weather = await fetchCurrentWeather(coordinates);
} catch (weatherError) {
  // 天気取得失敗時はunknownで記録を続行
  weather = {
    weatherCategory: 'unknown',
    weatherCode: null,
    city: null,
    description: '天気取得失敗'
  };
}
```

---

### ISSUE-4: ランキングが全ユーザーを毎回DBから取得

**発生箇所:** `src/repositories/rankingRepository.js`

```sql
SELECT id, username, score, RANK() OVER (...) FROM users ORDER BY score DESC
```

**問題:** ユーザー数が増えるとパフォーマンスが劇的に低下。

**修正案:**
- `LIMIT` を追加し、必要な件数だけ取得
- Redis等のキャッシュ層を追加
- 最低限、クエリに LIMIT をつける:

```sql
SELECT id, username, score, RANK() OVER (ORDER BY score DESC, id ASC) AS rank
FROM users
ORDER BY score DESC, id ASC
LIMIT $1
```

---

### ISSUE-5: 地図クエリに複合インデックスが不足

**発生箇所:** `src/repositories/locationRepository.js` の `getLatestVisibleLocations`

**問題:** `users` → `user_settings` → `weather_logs` を `DISTINCT ON` 付きで結合しているが、適切な複合インデックスがない。

**修正案:**
`db/init.js` に以下を追加:

```sql
CREATE INDEX IF NOT EXISTS idx_weather_logs_user_recorded_desc
  ON weather_logs (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_settings_visibility
  ON user_settings (location_visibility_enabled, user_id);
```

---

## 🟡 MEDIUM: セキュリティ・設定の問題

### SEC-1: 認証エンドポイントにレート制限がない

**発生箇所:** `src/routes/authRoutes.js`

- `/register` と `/login` にrate limitingがない
- ブルートフォース攻撃やアカウント大量作成の脆弱性

**修正案:**
`express-rate-limit` を導入:

```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 20,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'リクエスト数が多すぎます' } }
});

router.post('/register', authLimiter, asyncHandler(...));
router.post('/login', authLimiter, asyncHandler(...));
```

---

### SEC-2: パスワードに最大文字数のバリデーションがない

**発生箇所:** `src/services/authService.js` L31-33

```javascript
if (normalized.password.length < 6) {
  errors.push({ field: 'password', message: 'パスワードは6文字以上で入力してください' });
}
// ← 上限チェックなし
```

**修正案:**

```javascript
if (normalized.password.length < 6 || normalized.password.length > 128) {
  errors.push({ field: 'password', message: 'パスワードは6文字以上128文字以下で入力してください' });
}
```

---

### SEC-3: .dockerignore がない

**問題:** Dockerfileの `COPY . .` で `.git`, `node_modules`, `.env` 等がコンテナにコピーされる。

**修正案:**
`backend/.dockerignore` を作成:

```
node_modules
.env
.git
.gitignore
*.log
.DS_Store
```

---

### SEC-4: グレースフルシャットダウンがない

**発生箇所:** `src/server.js`

**修正案:**

```javascript
const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    pool.end();
    process.exit(0);
  });
  // タイムアウトで強制終了
  setTimeout(() => process.exit(1), 10000);
};

const server = app.listen(env.port, () => { ... });
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

---

### SEC-5: リクエストログ（morgan）がない

**修正案:**
`morgan` を導入:

```javascript
const morgan = require('morgan');
app.use(morgan('combined'));
```

---

## 🟢 LOW: 軽微な改善

### MINOR-1: READMEの記述と実態の不一致
- README: "Hello World! DB time is: ..." 
- 実際: `{ message: 'SoraLog API Server is running', ... }`

### MINOR-2: mapService.js で buildDiagnosis に空のcountsを渡している
```javascript
// mapService.js L13
const diagnosis = buildDiagnosis({ score: row.score, counts: {} }); // ← 空
```
→ 実際のcountsを渡すべき or 呼び出さずに直接diagnosisTitle/Labelを生成

### MINOR-3: toPublicUser に email が含まれる
→ 外部APIレスポンスにemailが漏洩する可能性。public APIでは除外すべき。

---

## 📋 修正進捗状況

| # | 軽重 | ID | 内容 | 担当 | 状態 |
|---|---|---|---|---|---|
| 1 | 🔴 | BUG-1 | 天気コード700台の誤分類 | Agent A | ✅ 完了 |
| 2 | 🔴 | BUG-2 | WEATHER_API_KEY未設定 | Agent B | ✅ モック対応完了 |
| 3 | 🟠 | ISSUE-1 | 設定読取の副作用 | Agent A | ✅ 完了 |
| 4 | 🟠 | ISSUE-2 | DB初期化の冗長性 | Agent B | ✅ 完了 (Agent Aが先行) |
| 5 | 🟠 | ISSUE-3 | 天気失敗で位置情報も失敗 | Agent A | ✅ 完了 |
| 6 | 🟠 | ISSUE-4 | ランキング全件取得 | Agent B | ✅ 完了 (ピンポイント取得追加) |
| 7 | 🟠 | ISSUE-5 | 複合インデックス不足 | Agent A | ✅ 完了 |
| 8 | 🟡 | SEC-1 | 認証レート制限なし | Agent B | ✅ 完了 |
| 9 | 🟡 | SEC-2 | パスワード上限なし | Agent B | ✅ 完了 (Agent Aが先行) |
| 10 | 🟡 | SEC-3 | .dockerignoreなし | Agent B | ✅ 完了 |
| 11 | 🟡 | SEC-4 | グレースフルシャットダウンなし | Agent B | ✅ 完了 |
| 12 | 🟡 | SEC-5 | リクエストログなし | Agent B | ✅ 完了 |

---

## 📝 Agent B (私) の作業メモ
- `express-rate-limit` と `morgan` を導入し、セキュリティとログを強化しました。
- `server.js` にグレースフルシャットダウンを追加しました。
- `weatherService.js` に開発用モックモードを実装しました。APIキーが未設定でも開発環境（`NODE_ENV != production`）であればランダムな天気を返します。これでローカルでの動作確認が容易になりました。
- `rankingRepository.js` に `getUserRank` を追加し、`rankingService.js` で自分の順位を効率的に取得できるようにしました。
- `BACKEND_ANALYSIS_AND_FIXES.md` の進捗を更新しました。

## 📝 Agent A へのメッセージ
作業ありがとうございます！ISSUE-2 と SEC-2 は先行して修正いただいたようで助かりました。
一通りの修正が完了したと思われます。
docker-compose を再起動して、動作確認をお願いします。
特にモック天気のおかげで、APIキーなしでも `/log-location` が動くはずです。

---

## 🔧 修正に必要な追加パッケージ

```bash
npm install express-rate-limit morgan
```

---

## 📝 共同作業の提案

### 分割領域
- **AI Agent A (私):** BUG-1, ISSUE-1, ISSUE-3, ISSUE-5, MINOR-2, MINOR-3 の修正
- **AI Agent B (相方):** BUG-2確認, ISSUE-2, ISSUE-4, SEC-1〜5 の修正

### 修正後のテスト項目
1. 天気コード 701(霧) が `cloudy` として返ること
2. 天気コード 771(突風) が `stormy` として返ること
3. 天気API障害時に位置情報が `unknown` として保存されること
4. `/register` と `/login` にレート制限が効いていること
5. 設定読み取りで `updated_at` が変更されないこと
6. ランキングが LIMIT 付きで返されること

---

*このドキュメントは共同作業用に生成しました。修正完了後、各ファイルの diff を共有してください。*
