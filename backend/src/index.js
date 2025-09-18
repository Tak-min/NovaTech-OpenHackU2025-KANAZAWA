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

// 環境変数のチェック
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set');
    process.exit(1);
}
if (!process.env.WEATHER_API_KEY) {
    console.error('WEATHER_API_KEY environment variable is not set');
    process.exit(1);
}

// JSON形式のリクエストボディを解析できるようにする
app.use(express.json());

// ===== CORS 設定 (複数オリジン + 環境変数対応) =====
// 環境変数 FRONTEND_ORIGINS でカンマ区切り指定可能 例: https://example.com,https://foo.app
const defaultOrigins = [
    'https://soralog-qnka.onrender.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174'
];
const extraOrigins = (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...extraOrigins]));

console.log('CORS allowed origins:', allowedOrigins);

app.use(cors({
    origin: (origin, callback) => {
        // origin が undefined の場合 (curl や 同一オリジン) は許可
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn('Blocked by CORS:', origin);
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// ================================================

// データベース接続プールの設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // ===== 以下のssl設定を追加 =====
    ssl: {
        rejectUnauthorized: false
    },
    // 接続タイムアウト設定
    connectionTimeoutMillis: 10000, // 10秒
    query_timeout: 10000, // 10秒
    idleTimeoutMillis: 30000, // 30秒
    max: 20, // 最大接続数
});

const createTables = async () => {
    const client = await pool.connect();
    try {
        console.log('Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                gender VARCHAR(10), -- 性別を追加
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Users table created or already exists.');

        // 既存テーブルにgenderカラムが存在しない場合、追加
        try {
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
            `);
            console.log('Gender column added or already exists.');
        } catch (alterError) {
            console.log('Gender column alter attempted:', alterError.message);
        }

        console.log('Creating locations table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                geom GEOMETRY(Point, 4326) NOT NULL, -- 緯度経度を保存する
                weather VARCHAR(50),
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Locations table created or already exists.');
        console.log('All tables created successfully.');
    } catch (err) {
        console.error("Error creating tables:", err.stack);
        throw err; // エラーを投げてサーバー起動を停止
    } finally {
        client.release();
    }
};

// [ミドルウェア] JWTを検証してユーザー情報をリクエストに付与する
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" の形式

    console.log('Auth header:', authHeader); // デバッグログ
    console.log('Extracted token:', token ? '***' : null); // トークンを隠してログ出力

    if (token == null) {
        console.log('No token provided'); // デバッグログ
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification failed:', err.message); // デバッグログ
            return res.sendStatus(403); // Forbidden
        }
        console.log('Token verified for user:', user.username); // デバッグログ
        req.user = user; // リクエストオブジェクトにユーザー情報を付与
        next(); // 次の処理へ
    });
};

// ===== ルートハンドラー =====
// [GET] / - APIヘルスチェック
app.get('/', (req, res) => {
    res.json({
        message: 'SoraLog API Server is running',
        version: '1.0.0',
        endpoints: {
            auth: ['POST /register', 'POST /login', 'GET /status'],
            location: ['POST /log-location'],
            ranking: ['GET /ranking'],
            map: ['GET /users-locations'],
            debug: ['GET /debug/users']
        },
        timestamp: new Date().toISOString()
    });
});

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
app.get('/ranking', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Ranking Error', error);
        res.status(500).json({ message: 'ランキングの取得に失敗しました' });
    }
});


// [POST] /register - 新規ユーザー登録
app.post('/register', async (req, res) => {
    try {
        console.log('=== REGISTER ATTEMPT ===');
        console.log('Register endpoint hit at:', new Date().toISOString());
        const { username, email, password, gender } = req.body;
        console.log('Request body:', { username, email, passwordLength: password ? password.length : 0, gender });

        // 入力バリデーション
        if (!username || !email || !password) {
            console.log('Validation failed: Missing required fields');
            return res.status(400).json({ message: '必須項目を入力してください' });
        }

        // ユーザー名の長さチェック
        if (username.length < 3 || username.length > 50) {
            console.log('Validation failed: Invalid username length');
            return res.status(400).json({ message: 'ユーザー名は3文字以上50文字以下で入力してください' });
        }

        // メールアドレスの形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('Validation failed: Invalid email format');
            return res.status(400).json({ message: '有効なメールアドレスを入力してください' });
        }

        // パスワードの長さチェック
        if (password.length < 6) {
            console.log('Validation failed: Password too short');
            return res.status(400).json({ message: 'パスワードは6文字以上で入力してください' });
        }

        // 性別のバリデーション
        const validGenders = ['male', 'female', 'other'];
        if (gender && !validGenders.includes(gender)) {
            console.log('Validation failed: Invalid gender');
            return res.status(400).json({ message: '性別はmale、female、otherのいずれかを選択してください' });
        }

        console.log('Creating password hash...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        console.log('Inserting user into database...');
        const newUser = await pool.query(
            'INSERT INTO users (username, email, password_hash, gender) VALUES ($1, $2, $3, $4) RETURNING id, username',
            [username, email, passwordHash, gender]
        );

        console.log('User registered successfully:', newUser.rows[0].username);
        res.status(201).json({
            message: 'ユーザー登録が成功しました',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error('=== REGISTER ERROR ===');
        console.error('Error in /register endpoint:', error);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);

        if (error.code === '23505') {
            console.log('Duplicate key error - user already exists');
            return res.status(409).json({ message: 'このメールアドレスまたはユーザー名は既に使用されています' });
        }
        if (error.code === 'ECONNREFUSED') {
            console.log('Database connection refused');
            return res.status(503).json({ message: 'データベース接続エラー' });
        }
        res.status(500).json({
            message: 'サーバーエラーが発生しました',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// [POST] /login - ログイン
app.post('/login', async (req, res) => {
    try {
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Login endpoint hit at:', new Date().toISOString());
        const { email, password } = req.body;
        console.log('Request body:', { email, password: password ? '***' : 'empty' });

        // 入力バリデーション
        if (!email || !password) {
            console.log('Validation failed: Missing email or password');
            return res.status(400).json({ message: 'メールアドレスとパスワードを入力してください' });
        }

        // メールアドレスの形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('Validation failed: Invalid email format');
            return res.status(400).json({ message: '有効なメールアドレスを入力してください' });
        }

        console.log('Querying database for user:', email);
        // 1. メールアドレスでユーザーを検索
        const userResult = await pool.query('SELECT id, username, password_hash FROM users WHERE email = $1', [email]);
        console.log('Database query result - rows found:', userResult.rows.length);

        if (userResult.rows.length === 0) {
            console.log('User not found for email:', email);
            return res.status(401).json({ message: 'メールアドレスまたはパスワードが正しくありません' });
        }
        const user = userResult.rows[0];
        console.log('User found:', { id: user.id, username: user.username });

        // 2. パスワードが正しいか照合
        console.log('Comparing passwords...');
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        console.log('Password comparison result:', isPasswordCorrect);

        if (!isPasswordCorrect) {
            console.log('Incorrect password for user:', user.username);
            return res.status(401).json({ message: 'メールアドレスまたはパスワードが正しくありません' });
        }

        // 3. 認証トークン(JWT)を生成
        console.log('Generating JWT token...');
        const payload = {
            id: user.id,
            username: user.username
        };
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // トークンの有効期限 (例: 1時間)
        );
        console.log('JWT token generated successfully');

        console.log('Login successful for user:', user.username);
        res.json({
            message: 'ログインに成功しました',
            token: token
        });

    } catch (error) {
        console.error('=== LOGIN ERROR ===');
        console.error('Error in /login endpoint:', error);
        console.error('Error stack:', error.stack);
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'データベース接続エラー' });
        }
        res.status(500).json({
            message: 'サーバーエラーが発生しました',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// サーバー起動とDB接続確認
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`CORS origin set to: https://soralog-qnka.onrender.com`);

    try {
        const client = await pool.connect();
        console.log('Database connection successful!');
        console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
        client.release();
        await createTables();
        console.log('Server startup completed successfully');
    } catch (err) {
        console.error('Database connection error:', err.stack);
        console.error('Please check your DATABASE_URL environment variable');
        process.exit(1); // データベース接続に失敗したらサーバーを停止
    }
});

app.get('/debug/users', async (req, res) => {
    try {
        const users = await pool.query('SELECT id, username, email, gender, created_at FROM users ORDER BY created_at DESC LIMIT 10');
        res.json({
            success: true,
            users: users.rows,
            count: users.rows.length
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});