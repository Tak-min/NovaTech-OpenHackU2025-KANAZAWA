// backend/src/index.js

// ライブラリのインポート
const express = require('express');
const axios = require('axios');
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
app.use(cors({
  origin: 'https://solalog.onrender.com', // フロントエンドのURLを指定
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 許可するHTTPメソッド
  credentials: true // クッキーや認証情報を含むリクエストを許可
}));

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
app.post('/log-location', authenticateToken, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.id;

        if (latitude == null || longitude == null) {
            return res.status(400).json({ message: '緯度と経度が必要です' });
        }

        // --- 実際の天気情報を取得 ---
        const apiKey = process.env.WEATHER_API_KEY;
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}`;

        const weatherResponse = await axios.get(apiUrl);
        const weatherData = weatherResponse.data;

        // OpenWeatherMapの天候コードから、アプリ内のカテゴリに変換
        // https://openweathermap.org/weather-conditions
        const weatherCode = weatherData.weather[0].id;
        let weather;
        if (weatherCode >= 200 && weatherCode < 300) {
            weather = 'thunderstorm'; // 雷
        } else if (weatherCode >= 300 && weatherCode < 600) {
            weather = 'rainy'; // 雨・霧雨
        } else if (weatherCode >= 600 && weatherCode < 700) {
            weather = 'snowy'; // 雪
        } else if (weatherCode >= 700 && weatherCode < 800) {
            weather = 'stormy'; // 嵐・霧など
        } else if (weatherCode === 800) {
            weather = 'sunny'; // 快晴
        } else if (weatherCode > 800) {
            weather = 'cloudy'; // 曇り
        } else {
            weather = 'unknown'; // 不明
        }

        // データベースに位置情報と天気を保存
        const logQuery = `
      INSERT INTO locations (user_id, geom, weather, recorded_at)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, NOW())
    `;
        await pool.query(logQuery, [userId, longitude, latitude, weather]);

        res.status(201).json({
            message: '位置情報を記録しました',
            weather: weather,
            city: weatherData.name // APIから取得した都市名も返してみる
        });

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Weather API error:', error.response.data);
            return res.status(502).json({ message: '天気情報の取得に失敗しました' });
        }
        console.error(error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// [GET] /status - ユーザーの現在の晴れ/雨判定を取得
app.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const weatherRecords = await pool.query(
            'SELECT weather, COUNT(*) as count FROM locations WHERE user_id = $1 GROUP BY weather',
            [userId]
        );

        // 天気ごとのスコアを定義
        const scores = {
            'sunny': 1,
            'cloudy': 0.5,
            'rainy': -1,
            'snowy': 2, // 雪は少しレアなので高めのプラススコア
            'thunderstorm': -3, // 雷は影響が大きいのでマイナススコア
            'stormy': -2,
        };

        // 合計スコアを計算
        let totalScore = 0;
        const counts = {};
        for (const record of weatherRecords.rows) {
            const weather = record.weather;
            const count = parseInt(record.count, 10);
            counts[weather] = count;
            if (scores[weather]) {
                totalScore += scores[weather] * count;
            }
        }

        // スコアに応じた称号を決定
        let status = '凡人';
        if (weatherRecords.rows.length > 0) {
            if (totalScore > 5) status = '太陽神';
            else if (totalScore > 0) status = '晴れ男'; // ここは性別に応じて「晴れ女」と変えても良い
            else if (totalScore < -5) status = '嵐を呼ぶ者';
            else if (totalScore < 0) status = '雨男'; // 同上
        }

        res.json({
            status: status,
            score: totalScore,
            counts: counts // 各天気の回数も返す
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// [GET] /users-locations - 全ユーザーの最新位置情報を取得
app.get('/users-locations', authenticateToken, async (req, res) => {
    try {
        // 各ユーザーの最新の位置情報を取得
        const locationsQuery = `
      SELECT DISTINCT ON (u.id) 
        u.id,
        u.username,
        ST_X(l.geom) as longitude,
        ST_Y(l.geom) as latitude,
        l.weather,
        l.recorded_at
      FROM users u
      JOIN locations l ON u.id = l.user_id
      ORDER BY u.id, l.recorded_at DESC
    `;

        const result = await pool.query(locationsQuery);

        const userLocations = result.rows.map(row => ({
            id: row.id,
            username: row.username,
            latitude: parseFloat(row.latitude),
            longitude: parseFloat(row.longitude),
            weather: row.weather,
            recordedAt: row.recorded_at
        }));

        res.json({
            success: true,
            users: userLocations
        });

    } catch (error) {
        console.error('ユーザー位置情報取得エラー:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// [GET] /ranking - Get top 10 user rankings
app.get('/ranking', async (req, res) =>{
  try{
    const rankingQuery = `
      SELECT
        u.id,
        u.username,
        COALESCE(SUM(
          CASE l.weather
            WHEN 'sunny' THEN 1
            WHEN 'cloudy' THEN 0.5
            WHEN 'rainy' THEN -1
            WHEN 'snowy' THEN 2
            WHEN 'thunderstorm' THEN -3
            WHEN 'stormy' THEN -2
            ELSE 0
          END
        ), 0) AS score
      FROM
        users u
      LEFT JOIN
        locations l ON u.id = l.user_id
      GROUP BY
        u.id, u.username
      ORDER BY
        score DESC
      LIMIT 10;
    `;

    const rankingResult = await pool.query(rankingQuery);

    res.json(rankingResult.rows);
  }catch (error) {
    console.error('Ranking Error', error);
    res.status(500).json({message: 'ランキングの取得に失敗しました'});
  }
});


// [POST] /register - 新規ユーザー登録
app.post('/register', async (req, res) => {
    try {
        // 1. gender をリクエストボディから受け取る
        const { username, email, password, gender } = req.body;

        if (!username || !email || !password) {
          return res.status(400).json({ message: '必須項目を入力してください' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 2. INSERT文に gender を追加
        const newUser = await pool.query(
          'INSERT INTO users (username, email, password_hash, gender) VALUES ($1, $2, $3, $4) RETURNING id, username',
          [username, email, passwordHash, gender]
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