# バックエンド完全分析レポート & 改善実績

> 生成日: 2025-06-01  
> 対象: NovaTech-OpenHackU2025-KANAZAWA (Node.js/Express/PostgreSQL + Vue.js Frontend)

---

## 📁 プロジェクト全体構成

```
NovaTech-OpenHackU2025-KANAZAWA/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore          ← 新規作成
│   ├── package.json           ← express-rate-limit, morgan 追加
│   └── src/
│       ├── server.js          ← グレースフルシャットダウン追加
│       ├── app.js             ← morgan ログ追加
│       ├── config/env.js
│       ├── db/
│       │   ├── init.js        ← 冗長ALTER整理、インデックス追加
│       │   └── pool.js
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── errorHandler.js
│       │   └── validate.js
│       ├── repositories/
│       │   ├── locationRepository.js
│       │   ├── rankingRepository.js  ← LIMIT対応
│       │   ├── settingsRepository.js ← 副作用除去
│       │   └── userRepository.js     ← email漏洩修正
│       ├── routes/
│       │   ├── authRoutes.js         ← レート制限追加
│       │   ├── locationRoutes.js
│       │   ├── mapRoutes.js
│       │   ├── rankingRoutes.js
│       │   ├── statusRoutes.js
│       │   └── userRoutes.js
│       ├── services/
│       │   ├── authService.js        ← toAuthUser使用に変更
│       │   ├── locationService.js    ← フォールバック追加
│       │   ├── mapService.js         ← 空counts問題修正
│       │   ├── rankingService.js     ← LIMIT対応
│       │   ├── scoreService.js       ← 天気コード修正
│       │   ├── statusService.js
│       │   ├── userService.js
│       │   └── weatherService.js
│       └── utils/
│           ├── apiResponse.js
│           ├── asyncHandler.js
│           └── errors.js
├── frontend/
│   ├── src/
│   │   ├── api/client.js
│   │   ├── app/constants.js
│   │   └── ...
│   └── package.json
├── .env                          ← WEATHER_API_KEY修正
├── .env.example                  ← WEATHER_API_KEY修正
├── docker-compose.yml
├── BACKEND_ANALYSIS_AND_FIXES.md
└── FIX_PROGRESS.md
```

---

## ✅ 完了した修正一覧 (13件)

### 🔴 重大バグ修正

| # | ID | 内容 | ファイル |
|---|---|---|---|
| 1 | BUG-1 | 天気コード700番台の誤分類 (stormy→cloudy) | `scoreService.js` |
| 2 | BUG-2 | WEATHER_API_KEY未設定時のメッセージ改善 | `.env` + `.env.example` |

### 🟠 設計上の問題修正

| # | ID | 内容 | ファイル |
|---|---|---|---|
| 3 | ISSUE-1 | settingsRepository.getByUserId の副作用除去 | `settingsRepository.js` |
| 4 | ISSUE-2 | DB初期化の冗長ALTER文整理 | `db/init.js` |
| 5 | ISSUE-3 | 天気取得失敗時のフォールバック処理 | `locationService.js` |
| 6 | ISSUE-4 | ランキングの全件取得をLIMIT付きに | `rankingRepository.js` + `rankingService.js` |
| 7 | ISSUE-5 | 複合インデックス追加 | `db/init.js` |

### 🟡 セキュリティ・運用改善

| # | ID | 内容 | ファイル |
|---|---|---|---|
| 8 | SEC-1 | 認証エンドポイントにレート制限追加 | `authRoutes.js` |
| 9 | SEC-3 | .dockerignore の作成 | `backend/.dockerignore` |
| 10 | SEC-4 | グレースフルシャットダウン追加 | `server.js` |
| 11 | SEC-5 | リクエストログ (morgan) 導入 | `app.js` |

### 🟢 軽微な改善

| # | ID | 内容 | ファイル |
|---|---|---|---|
| 12 | MINOR-2 | mapService.js の空 counts 問題修正 | `mapService.js` |
| 13 | MINOR-3 | APIレスポンスから email 漏洩防止 | `userRepository.js` + `authService.js` |

---

## 🔧 各修正の詳細

### 1. 天気コード700番台の誤分類 (BUG-1)

**問題:**
OpenWeatherMapの700番台は「大気現象」（霧、もや、砂塵など）だが、嵐(stormy)として分類していた。

**修正:**
```javascript
// 旧
if (code >= 700 && code < 800) return 'stormy';

// 新
if (code === 771 || code === 781) return 'stormy'; // 突風、竜巻のみ
if (code >= 700 && code < 800) return 'cloudy';    // それ以外はくもり
```

### 2. WEATHER_API_KEY未設定時の改善 (BUG-2)

**問題:**
`.env` に `your_openweathermap_api_key` というプレースホルダーが残っていた。

**修正:**
- `.env`: 空文字に変更し、コメントでAPIキー取得方法を記載
- `.env.example`: 同様にコメント追加

### 3. settingsRepository.getByUserId の副作用除去 (ISSUE-1)

**問題:**
設定を読むたびに `INSERT ... ON CONFLICT` が実行され、`updated_at` が更新されていた。

**修正:**
```javascript
// 旧
const getByUserId = async (userId, db = pool) => {
  const ensured = await ensureForUser(userId, db); // 毎回INSERT
  return ensured;
};

// 新
const getByUserId = async (userId, db = pool) => {
  const result = await query(
    db,
    `SELECT ... FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    return ensureForUser(userId, db); // 初回のみINSERT
  }
  return normalizeSettings(result.rows[0]);
};
```

### 4. DB初期化の冗長ALTER文整理 (ISSUE-2)

**問題:**
`CREATE TABLE IF NOT EXISTS` 後に、同じテーブルに対して `ALTER TABLE ADD COLUMN IF NOT EXISTS` を毎回実行していた。

**修正:**
- `CREATE TABLE` で全カラムを1つのDDLで定義
- 旧カラムの移行は `DO $$ ... END $$;` ブロックで1回のみ実行

### 5. 天気取得失敗時のフォールバック (ISSUE-3)

**問題:**
天気API障害時に位置情報も天気ログも保存されなかった。

**修正:**
```javascript
const fetchWeatherWithFallback = async (coordinates) => {
  try {
    const weather = await fetchCurrentWeather(coordinates);
    return { ...weather, fallback: false };
  } catch (_error) {
    return {
      weatherCategory: 'unknown',
      weatherCode: null,
      city: null,
      description: '天気情報取得失敗',
      fallback: true
    };
  }
};
```

### 6. ランキングのLIMIT対応 (ISSUE-4)

**問題:**
全ユーザーをDBから取得してからスライスしていた。

**修正:**
```javascript
// リポジトリにLIMITパラメータ追加
const getWeatherRankingRows = async (limit = 100, db = pool) => {
  const result = await db.query(`
    SELECT ... FROM users ORDER BY score DESC LIMIT $1
  `, [limit]);
  return result.rows;
};
```

### 7. 認証エンドポイントにレート制限 (SEC-1)

**修正:**
```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 20,                   // 最大20リクエスト
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'リクエスト数が多すぎます。しばらく待ってからお試しください。'
    }
  }
});

router.post('/register', authLimiter, asyncHandler(...));
router.post('/login', authLimiter, asyncHandler(...));
```

### 8. リクエストログ (SEC-5)

**修正:**
```javascript
const morgan = require('morgan');
app.use(morgan(env.isProduction ? 'combined' : 'dev'));
```

### 9. グレースフルシャットダウン (SEC-4)

**修正:**
```javascript
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### 10. email漏洩防止 (MINOR-3)

**修正:**
```javascript
// 旧: toPublicUser にemailが含まれていた
const toPublicUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,       // ← 漏洩
  ...
});

// 新: emailを除外し、toAuthUserを新設
const toPublicUser = (row) => ({
  id: row.id,
  username: row.username,
  gender: row.gender,
  score: row.score,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toAuthUser = (row) => ({
  ...toPublicUser(row),
  email: row.email  // 内部用のみ
});
```

---

## 📋 修正後のテスト項目

1. ✅ 天気コード 701(霧) が `cloudy` として返ること
2. ✅ 天気コード 771(突風) が `stormy` として返ること
3. ✅ 天気API障害時に位置情報が `unknown` として保存されること
4. ✅ `/register` と `/login` にレート制限が効いていること
5. ✅ 設定読み取りで `updated_at` が変更されないこと
6. ✅ ランキングが LIMIT 付きで返されること
7. ✅ APIレスポンスに email が含まれていないこと
8. ✅ リクエストログが出力されること
9. ✅ サーバー停止時に SIGTERM/SIGINT でグレースフルシャットダウンされること

---

## 🔧 必要な追加パッケージ (package.json 更新済み)

```bash
cd backend
npm install express-rate-limit morgan
```

---

## 📊 パフォーマンス改善効果

| 改善項目 | Before | After |
|---|---|---|
| ランキング取得 | 全ユーザー取得 | LIMIT適用で軽量化 |
| 設定読み取り | INSERT副作用あり | SELECTのみ (初回のみINSERT) |
| 地図クエリ | インデックスなし | 複合インデックス追加 |
| DB初期化 | 冗長なALTER文毎回実行 | 1回のみ |

---

## 🛡️ セキュリティ改善効果

| 改善項目 | Before | After |
|---|---|---|
| 認証エンドポイント | レート制限なし | 15分間に20リクエスト |
| APIレスポンス | email漏洩 | email除外 |
| .dockerignore | なし | .env, node_modules等除外 |
| シャットダウン | 急停止 | グレースフルシャットダウン |

---

## 📝 共同作業ドキュメント

- `BACKEND_ANALYSIS_AND_FIXES.md` - 全問題点の詳細分析
- `FIX_PROGRESS.md` - 修正進捗レポート
- `BACKEND_COMPLETE_ANALYSIS.md` - 本ドキュメント (完全版)
