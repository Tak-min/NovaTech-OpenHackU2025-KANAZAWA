// backend/src/index.js

// ライブラリのインポート
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');


// Expressアプリの初期化
const app = express();
const PORT = process.env.PORT || 3000;

// JSON形式のリクエストボディを解析できるようにする
app.use(express.json());
app.use(cors());


// データベース接続プールの設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                geom GEOMETRY(Point, 4326) NOT NULL, -- 緯度経度を保存する
                weather VARCHAR(50),
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('tables created successfully or already exist.');
    } catch (err) {
        console.error("error creating tables:", err.stack);
    } finally {
        client.release();
    }
};

// [ミドルウェア] JWTを検証してユーザー情報をリクエストに付与する
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" の形式

  if (token == null) {
    return res.sendStatus(401); // Unauthorized
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Forbidden
    }
    req.user = user; // リクエストオブジェクトにユーザー情報を付与
    next(); // 次の処理へ
  });
};

// [POST] /log-location - ユーザーの位置情報と天気を記録
// authenticateTokenミドルウェアを間に挟むことで、認証が必要なルートになる
app.post('/log-location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id; // ミドルウェアが付与したユーザー情報

    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: '緯度と経度が必要です' });
    }

    // --- 天気情報の取得 ---
    // 💡ハッカソンTIPS: ここでは外部APIを叩かず、一旦ランダムな天気を返す
    // 本来はOpenWeatherMapなどのAPIを呼び出す
    const weather = Math.random() < 0.7 ? 'sunny' : 'rainy'; // 70%の確率で晴れ

    // データベースに位置情報と天気を保存
    // PostGISのST_MakePoint関数を使って緯度経度を地理空間データに変換
    const logQuery = `
      INSERT INTO locations (user_id, geom, weather, recorded_at)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, NOW())
    `;
    await pool.query(logQuery, [userId, longitude, latitude, weather]);

    res.status(201).json({ 
      message: '位置情報を記録しました',
      weather: weather 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'サーバーエラーが発生しました' });
  }
});

// [GET] /status - ユーザーの現在の晴れ/雨判定を取得
app.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // 認証ミドルウェアからユーザーIDを取得

    // データベースから、そのユーザーの天気記録をすべて取得
    const weatherRecords = await pool.query(
      'SELECT weather FROM locations WHERE user_id = $1',
      [userId]
    );

    // 晴れと雨の回数をカウント
    let sunnyCount = 0;
    let rainyCount = 0;
    for (const record of weatherRecords.rows) {
      if (record.weather === 'sunny') {
        sunnyCount++;
      } else if (record.weather === 'rainy') {
        rainyCount++;
      }
    }

    // 判定ロジック (ハッカソン用シンプル版)
    // 記録がなければ「凡人」
    // 晴れの回数が雨以上なら「晴れ男」
    // それ以外は「雨男」
    let status = '凡人';
    if (weatherRecords.rows.length > 0) {
      if (sunnyCount >= rainyCount) {
        status = '晴れ男';
      } else {
        status = '雨男';
      }
    }
    
    res.json({
      status: status,
      sunnyCount: sunnyCount,
      rainyCount: rainyCount
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'サーバーエラーが発生しました' });
  }
});

// [POST] /register - 新規ユーザー登録
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. 入力値のバリデーション (簡易版)
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'すべての項目を入力してください' });
    }

    // 2. パスワードをハッシュ化
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. データベースにユーザーを保存
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, passwordHash]
    );

    res.status(201).json({ 
        message: 'ユーザー登録が成功しました',
        user: newUser.rows[0] 
    });

  } catch (error) {
    // メールアドレスやユーザー名が重複した場合のエラー処理
    if (error.code === '23505') {
      return res.status(409).json({ message: 'このメールアドレスまたはユーザー名は既に使用されています' });
    }
    console.error(error);
    res.status(500).json({ message: 'サーバーエラーが発生しました' });
  }
});

// [POST] /login - ログイン
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. メールアドレスでユーザーを検索
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'メールアドレスまたはパスワードが正しくありません' });
    }
    const user = userResult.rows[0];

    // 2. パスワードが正しいか照合
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // 3. 認証トークン(JWT)を生成
    const payload = { 
      id: user.id,
      username: user.username 
    };
    const token = jwt.sign(
      payload, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' } // トークンの有効期限 (例: 1時間)
    );

    res.json({
      message: 'ログインに成功しました',
      token: token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'サーバーエラーが発生しました' });
  }
});


// サーバー起動とDB接続確認
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  try {
    const client = await pool.connect();
    console.log('Database connection successful!');
    client.release();
    await createTables();
  } catch (err) {
    console.error('Database connection error:', err.stack);
  }
});

app.get('/', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        res.send(`hello world! DB time is: ${result.rows[0].now}`);
        client.release();
    } catch (err) {
        res.status(500).send('database connection error');
    }
});