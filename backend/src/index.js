// backend/src/index.js

// ライブラリのインポート
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const STATIONS = [
    // 神戸市
    { name: '甲南山手', latitude: 34.73049, longitude: 135.29216 },
    { name: '摂津本山', latitude: 34.72655, longitude: 135.27658 },
    { name: '住吉', latitude: 34.71969, longitude: 135.26221 },
    { name: '六甲道', latitude: 34.71501, longitude: 135.23859 },
    { name: '摩耶', latitude: 34.70867, longitude: 135.22504 },
    { name: '灘', latitude: 34.70589, longitude: 135.21638 },
    { name: '三ノ宮', latitude: 34.69471, longitude: 135.19489 },
    { name: '元町', latitude: 34.6897, longitude: 135.18738 },
    { name: '神戸', latitude: 34.67951, longitude: 135.17828 },
    { name: '兵庫', latitude: 34.66812, longitude: 135.16461 },
    { name: '新長田', latitude: 34.65772, longitude: 135.14557 },
    { name: '鷹取', latitude: 34.6516, longitude: 135.13529 },
    { name: '須磨海浜公園', latitude: 34.64709, longitude: 135.1265 },
    { name: '須磨', latitude: 34.64229, longitude: 135.11278 },
    { name: '塩屋', latitude: 34.63362, longitude: 135.08335 },
    { name: '垂水', latitude: 34.62933, longitude: 135.05377 },
    { name: '舞子', latitude: 34.63309, longitude: 135.03439 },
    { name: '和田岬', latitude: 34.65742, longitude: 135.17391 },
    { name: '道場', latitude: 34.86742, longitude: 135.25585 },
    { name: '新神戸', latitude: 34.70685, longitude: 135.19609 },
    { name: '新神戸', latitude: 34.70607, longitude: 135.19591 },
    { name: '三宮', latitude: 34.69412, longitude: 135.19271 },
    { name: '県庁前', latitude: 34.69103, longitude: 135.184 },
    { name: '大倉山', latitude: 34.68469, longitude: 135.17456 },
    { name: '湊川公園', latitude: 34.67937, longitude: 135.1672 },
    { name: '上沢', latitude: 34.67334, longitude: 135.15844 },
    { name: '長田', latitude: 34.66848, longitude: 135.15147 },
    { name: '新長田', latitude: 34.65755, longitude: 135.14457 },
    { name: '板宿', latitude: 34.65967, longitude: 135.13483 },
    { name: '妙法寺', latitude: 34.6751, longitude: 135.11008 },
    { name: '名谷', latitude: 34.67936, longitude: 135.09443 },
    { name: '総合運動公園', latitude: 34.68175, longitude: 135.07562 },
    { name: '学園都市', latitude: 34.68513, longitude: 135.05756 },
    { name: '伊川谷', latitude: 34.68786, longitude: 135.04131 },
    { name: '西神南', latitude: 34.69953, longitude: 135.03005 },
    { name: '西神中央', latitude: 34.71963, longitude: 135.01733 },
    { name: '三宮・花時計前', latitude: 34.69182, longitude: 135.19588 },
    { name: '旧居留地・大丸前', latitude: 34.68951, longitude: 135.19037 },
    { name: 'みなと元町', latitude: 34.68599, longitude: 135.18414 },
    { name: 'ハーバーランド', latitude: 34.67878, longitude: 135.17884 },
    { name: '中央市場前', latitude: 34.66619, longitude: 135.17588 },
    { name: '和田岬', latitude: 34.65658, longitude: 135.17479 },
    { name: '御崎公園', latitude: 34.65483, longitude: 135.16593 },
    { name: '苅藻', latitude: 34.65382, longitude: 135.15692 },
    { name: '駒ヶ林', latitude: 34.652, longitude: 135.14966 },
    { name: '新長田', latitude: 34.65671, longitude: 135.1451 },
    { name: '三宮', latitude: 34.69456, longitude: 135.19528 },
    { name: '貿易センター', latitude: 34.68946, longitude: 135.19945 },
    { name: 'ポートターミナル', latitude: 34.68137, longitude: 135.20226 },
    { name: '中公園', latitude: 34.67334, longitude: 135.20743 },
    { name: 'みなとじま', latitude: 34.66907, longitude: 135.21004 },
    { name: '市民広場', latitude: 34.66479, longitude: 135.2126 },
    { name: '医療センター', latitude: 34.65854, longitude: 135.21639 },
    { name: '計算科学センター', latitude: 34.6548, longitude: 135.22153 },
    { name: '神戸空港', latitude: 34.63732, longitude: 135.22888 },
    { name: '南公園', latitude: 34.66468, longitude: 135.21696 },
    { name: '中埠頭', latitude: 34.66941, longitude: 135.21716 },
    { name: '北埠頭', latitude: 34.67359, longitude: 135.21464 },
    { name: '住吉', latitude: 34.71952, longitude: 135.26224 },
    { name: '魚崎', latitude: 34.7137, longitude: 135.2686 },
    { name: '南魚崎', latitude: 34.7071, longitude: 135.26773 },
    { name: 'アイランド北口', latitude: 34.69314, longitude: 135.26874 },
    { name: 'アイランドセンター', latitude: 34.68924, longitude: 135.26933 },
    { name: 'マリンパーク', latitude: 34.68424, longitude: 135.27011 },
    { name: '岡本', latitude: 34.72917, longitude: 135.27594 },
    { name: '御影', latitude: 34.72463, longitude: 135.2523 },
    { name: '六甲', latitude: 34.7195, longitude: 135.23388 },
    { name: '王子公園', latitude: 34.71018, longitude: 135.21846 },
    { name: '春日野道', latitude: 34.703, longitude: 135.2053 },
    { name: '神戸三宮', latitude: 34.69308, longitude: 135.19274 },
    { name: '深江', latitude: 34.72268, longitude: 135.29161 },
    { name: '青木', latitude: 34.71723, longitude: 135.28076 },
    { name: '魚崎', latitude: 34.71267, longitude: 135.26948 },
    { name: '住吉', latitude: 34.71306, longitude: 135.26138 },
    { name: '御影', latitude: 34.71491, longitude: 135.25566 },
    { name: '石屋川', latitude: 34.7134, longitude: 135.24961 },
    { name: '新在家', latitude: 34.71063, longitude: 135.24048 },
    { name: '大石', latitude: 34.70776, longitude: 135.23102 },
    { name: '西灘', latitude: 34.70583, longitude: 135.22438 },
    { name: '岩屋', latitude: 34.70417, longitude: 135.21816 },
    { name: '春日野道', latitude: 34.69934, longitude: 135.20841 },
    { name: '神戸三宮', latitude: 34.69382, longitude: 135.19605 },
    { name: '元町', latitude: 34.6896, longitude: 135.18744 },
    { name: '花隈', latitude: 34.68655, longitude: 135.18159 },
    { name: '西元町', latitude: 34.6842, longitude: 135.17984 },
    { name: '高速神戸', latitude: 34.67976, longitude: 135.17504 },
    { name: '新開地', latitude: 34.67647, longitude: 135.17004 },
    { name: '大開', latitude: 34.67134, longitude: 135.16181 },
    { name: '高速長田', latitude: 34.66726, longitude: 135.1517 },
    { name: '湊川', latitude: 34.6793, longitude: 135.16627 },
    { name: '西代', latitude: 34.66241, longitude: 135.14406 },
    { name: '板宿', latitude: 34.66048, longitude: 135.13408 },
    { name: '東須磨', latitude: 34.65526, longitude: 135.12757 },
    { name: '月見山', latitude: 34.64982, longitude: 135.12164 },
    { name: '須磨寺', latitude: 34.64644, longitude: 135.11637 },
    { name: '山陽須磨', latitude: 34.64364, longitude: 135.11257 },
    { name: '須磨浦公園', latitude: 34.63793, longitude: 135.10009 },
    { name: '山陽塩屋', latitude: 34.63373, longitude: 135.08258 },
    { name: '滝の茶屋', latitude: 34.63098, longitude: 135.0721 },
    { name: '東垂水', latitude: 34.62922, longitude: 135.06301 },
    { name: '山陽垂水', latitude: 34.62964, longitude: 135.05376 },
    { name: '霞ヶ丘', latitude: 34.63043, longitude: 135.04259 },
    { name: '舞子公園', latitude: 34.63413, longitude: 135.0342 },
    { name: '西舞子', latitude: 34.63872, longitude: 135.02817 },
    { name: '長田', latitude: 34.68163, longitude: 135.14946 },
    { name: '丸山', latitude: 34.68592, longitude: 135.14403 },
    { name: '鵯越', latitude: 34.69273, longitude: 135.1421 },
    { name: '鈴蘭台', latitude: 34.72398, longitude: 135.14577 },
    { name: '北鈴蘭台', latitude: 34.73941, longitude: 135.15187 },
    { name: '山の町', latitude: 34.74673, longitude: 135.15292 },
    { name: '箕谷', latitude: 34.75688, longitude: 135.15555 },
    { name: '谷上', latitude: 34.76176, longitude: 135.17125 },
    { name: '花山', latitude: 34.76944, longitude: 135.18666 },
    { name: '大池', latitude: 34.78081, longitude: 135.19849 },
    { name: '神鉄六甲', latitude: 34.78559, longitude: 135.20656 },
    { name: '唐櫃台', latitude: 34.79031, longitude: 135.2115 },
    { name: '有馬口', latitude: 34.79675, longitude: 135.22098 },
    { name: '有馬温泉', latitude: 34.79935, longitude: 135.24617 },
    { name: '五社', latitude: 34.80602, longitude: 135.21615 },
    { name: '岡場', latitude: 34.82182, longitude: 135.22261 },
    { name: '田尾寺', latitude: 34.83553, longitude: 135.22596 },
    { name: '二郎', latitude: 34.84909, longitude: 135.22686 },
    { name: '道場南口', latitude: 34.8564, longitude: 135.22312 },
    { name: '神鉄道場', latitude: 34.86668, longitude: 135.22617 },
    { name: '鈴蘭台西口', latitude: 34.72633, longitude: 135.14008 },
    { name: '西鈴蘭台', latitude: 34.7259, longitude: 135.13489 },
    { name: '藍那', latitude: 34.73252, longitude: 135.11812 },
    { name: '木津', latitude: 34.74416, longitude: 135.08847 },
    { name: '木幡', latitude: 34.74848, longitude: 135.07119 },
    { name: '栄', latitude: 34.7554, longitude: 135.05663 },
    { name: '押部谷', latitude: 34.75675, longitude: 135.03925 },
    // 明石市
    { name: '朝霧', latitude: 34.64415, longitude: 135.01735 },
    { name: '明石', latitude: 34.64908, longitude: 134.99278 },
    { name: '西明石', latitude: 34.66608, longitude: 134.96005 },
    { name: '大久保', latitude: 34.68215, longitude: 134.93893 },
    { name: '魚住', latitude: 34.69653, longitude: 134.90593 },
    { name: '西明石', latitude: 34.66688, longitude: 134.96094 },
    { name: '大蔵谷', latitude: 34.64664, longitude: 135.00805 },
    { name: '人丸前', latitude: 34.64764, longitude: 135.00204 },
    { name: '山陽明石', latitude: 34.64869, longitude: 134.99322 },
    { name: '西新町', latitude: 34.64967, longitude: 134.9807 },
    { name: '林崎松江海岸', latitude: 34.65208, longitude: 134.96523 },
    { name: '藤江', latitude: 34.66371, longitude: 134.94735 },
    { name: '中八木', latitude: 34.60784, longitude: 134.93615 },
    { name: '江井ヶ島', latitude: 34.6793, longitude: 134.91932 },
    { name: '西江井ヶ島', latitude: 34.68595, longitude: 134.90779 },
    { name: '山陽魚住', latitude: 34.68952, longitude: 134.90158 },
    { name: '東二見', latitude: 34.70002, longitude: 134.88835 },
    { name: '西二見', latitude: 34.70707, longitude: 134.87713 },
    // 金沢市
    { name: '森本', latitude: 34.61244, longitude: 136.68951 },
    { name: '東金沢', latitude: 34.59363, longitude: 136.6696 },
    { name: '金沢', latitude: 36.57806, longitude: 136.64789 },
    { name: '西金沢', latitude: 36.55332, longitude: 136.62119 },
    { name: '蚊爪', latitude: 36.62591, longitude: 136.64314 },
    { name: '北間', latitude: 36.62269, longitude: 136.64121 },
    { name: '大河端', latitude: 36.61671, longitude: 136.64342 },
    { name: '三ツ屋', latitude: 36.61196, longitude: 136.64552 },
    { name: '三口', latitude: 36.60663, longitude: 136.6476 },
    { name: '割出', latitude: 36.60241, longitude: 136.64846 },
    { name: '磯部', latitude: 36.59662, longitude: 136.64831 },
    { name: '上諸江', latitude: 36.5909, longitude: 136.64891 },
    { name: '七ツ屋', latitude: 36.58294, longitude: 136.65177 },
    { name: '北鉄金沢', latitude: 36.57853, longitude: 136.64971 },
    { name: '野町', latitude: 36.55389, longitude: 136.64432 },
    { name: '西泉', latitude: 36.55351, longitude: 136.63364 },
    { name: '新西金沢', latitude: 36.55317, longitude: 136.62244 },
    { name: '馬替', latitude: 36.52299, longitude: 136.62057 },
    { name: '額住宅前', latitude: 36.51833, longitude: 136.61877 },
    { name: '乙丸', latitude: 36.51186, longitude: 136.61763 },
    { name: '四十万', latitude: 36.4989, longitude: 136.61566 }
];
const STATION_RADIUS_METERS = 70;
const MISS_COOLDOWN_MINUTES = 30;


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
app.use(express.json({ limit: '10mb' })); // ペイロードサイズを10MBに設定
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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


const isProduction = process.env.NODE_ENV === 'production';
// データベース接続プールの設定
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // ===== 以下のssl設定を追加 =====
    ssl: isProduction ? { rejectUnauthorized: false } : false,
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

        // 既存テーブルにmissed_train_countカラムが存在しない場合、追加
        try {
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS missed_train_count INTEGER DEFAULT 0;
            `);
            console.log('missed_train_count column added or already exists.');
        } catch (alterError) {
            console.log('missed_train_count column alter attempted:', alterError.message);
        }

        // 既存テーブルにlast_missed_train_atカラムが存在しない場合、追加
        try {
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS last_missed_train_at TIMESTAMP WITH TIME ZONE;
            `);
            console.log('last_missed_train_at column added or already exists.');
        } catch (alterError) {
            console.log('last_missed_train_at column alter attempted:', alterError.message);
        }

        // 既存テーブルにscoreカラムが存在しない場合、追加（累積スコア保存用）
        try {
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS score NUMERIC(10,2) DEFAULT 0;
            `);
            console.log('score column added or already exists.');
        } catch (alterError) {
            console.log('score column alter attempted:', alterError.message);
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

        console.log('Creating user_settings table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                notification_enabled BOOLEAN DEFAULT true,
                location_enabled BOOLEAN DEFAULT false,
                introduction_text TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );
        `);
        console.log('User settings table created or already exists.');

        console.log('Creating user_icons table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_icons (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                icon_data TEXT NOT NULL, -- Base64エンコードされた画像データ
                content_type VARCHAR(50) DEFAULT 'image/jpeg',
                file_size INTEGER,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );
        `);
        console.log('User icons table created or already exists.');

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

// [POST] /log-location - ユーザーの位置情報と天気とスコアを記録
app.post('/log-location', authenticateToken, async (req, res) => {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    if (latitude == null || longitude == null) {
        return res.status(400).json({ message: '緯度と経度が必要です' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 近接駅チェックと乗り遅れカウント（クールダウン考慮）
        for (const station of STATIONS) {
            const distanceQuery = `
                SELECT ST_Distance(
                  ST_MakePoint($1, $2)::geography,
                  ST_MakePoint($3, $4)::geography
                ) as distance;
            `;
            const distanceResult = await client.query(distanceQuery, [
                longitude,
                latitude,
                station.longitude,
                station.latitude
            ]);
            const distance = parseFloat(distanceResult.rows[0].distance);
            if (!Number.isNaN(distance) && distance <= STATION_RADIUS_METERS) {
                console.log(`${station.name}の半径${STATION_RADIUS_METERS}m以内にいます`);
                const updateUserQuery = `
                    UPDATE users
                    SET 
                        missed_train_count = missed_train_count + 1,
                        last_missed_train_at = NOW()
                    WHERE 
                        id = $1 AND 
                        (last_missed_train_at IS NULL OR last_missed_train_at < NOW() - INTERVAL '${MISS_COOLDOWN_MINUTES} minutes')
                    RETURNING *;
                `;
                const updateUser = await client.query(updateUserQuery, [userId]);
                if (updateUser.rowCount > 0) {
                    console.log(`ユーザーID${userId}の乗り遅れ回数をインクリメント`);
                }
                break; // 最初にヒットした駅で打ち切り
            }
        }

        // 天気情報を取得
        const apiKey = process.env.WEATHER_API_KEY;
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}`;
        console.log('天気APIリクエスト開始:', { latitude, longitude, apiUrl: apiUrl.replace(apiKey, '***') });
        const weatherResponse = await axios.get(apiUrl);
        const weatherData = weatherResponse.data;
        console.log('天気APIレスポンス受信:', {
            city: weatherData.name,
            weatherCode: weatherData.weather[0].id,
            description: weatherData.weather[0].description,
            temperature: weatherData.main.temp
        });

        // OpenWeatherMapの天候コードから、アプリ内のカテゴリに変換
        const weatherCode = weatherData.weather[0].id;
        let weather;
        if (weatherCode >= 200 && weatherCode < 300) {
            weather = 'thunderstorm';
        } else if (weatherCode >= 300 && weatherCode < 600) {
            weather = 'rainy';
        } else if (weatherCode >= 600 && weatherCode < 700) {
            weather = 'snowy';
        } else if (weatherCode >= 700 && weatherCode < 800) {
            weather = 'stormy';
        } else if (weatherCode === 800) {
            weather = 'sunny';
        } else if (weatherCode > 800) {
            weather = 'cloudy';
        } else {
            weather = 'unknown';
        }

        // 位置情報と天気を保存
        const insertLocation = `
            INSERT INTO locations (user_id, geom, weather, recorded_at)
            VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, NOW())
        `;
        await client.query(insertLocation, [userId, longitude, latitude, weather]);

        // 天気に応じたスコア変動を計算し、ユーザーの累積スコアを更新
        const scoreMap = {
            sunny: 1,
            cloudy: 0.5,
            rainy: -1,
            snowy: 2,
            thunderstorm: -3,
            stormy: -2
        };
        const scoreChange = scoreMap[weather] ?? 0;
        await client.query('UPDATE users SET score = score + $1 WHERE id = $2', [scoreChange, userId]);

        await client.query('COMMIT');
        return res.status(201).json({
            message: '位置情報を記録しました',
            weather,
            city: weatherData.name,
            scoreChange
        });
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) { }
        if (axios.isAxiosError(error)) {
            console.error('Weather API error:', error.response?.data || error.message);
            return res.status(502).json({ message: '天気情報の取得に失敗しました' });
        }
        console.error('Error in /log-location:', error);
        return res.status(500).json({ message: 'サーバーエラーが発生しました' });
    } finally {
        client.release();
    }
});

// [GET] /status - ユーザーの現在の称号・スコア・天気別回数・乗り遅れ回数を取得（統合版）
app.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // users.score・gender・missed_train_count と、天気別回数をまとめて取得
        const userQuery = `
            SELECT
                u.score,
                u.gender,
                u.missed_train_count,
                (
                    SELECT COALESCE(json_object_agg(weather, cnt), '{}'::json)
                    FROM (
                        SELECT weather, COUNT(*)::int AS cnt
                        FROM locations
                        WHERE user_id = $1
                        GROUP BY weather
                    ) AS wc
                ) AS counts
            FROM users u
            WHERE u.id = $1;
        `;

        const { rows } = await pool.query(userQuery, [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'ユーザーが見つかりません' });
        }

        const user = rows[0];
        const totalScore = user.score !== null ? parseFloat(user.score) : 0;
        const gender = user.gender; // 'male' | 'female' | 'other' | null
        const counts = user.counts || {};
        const missedTrainCount = user.missed_train_count || 0;

        // スコアに応じた称号を決定（genderで晴れ/雨の呼称を出し分け）
        let status = '凡人';
        if (totalScore > 500) {
            status = '太陽神';
        } else if (totalScore > 100) {
            status = (gender === 'female') ? '晴れ女' : '晴れ男';
        } else if (totalScore < -500) {
            status = '嵐を呼ぶ者';
        } else if (totalScore < -100) {
            status = (gender === 'female') ? '雨女' : '雨男';
        }

        res.json({
            status,
            score: totalScore,
            counts,
            missedTrainCount
        });
    } catch (error) {
        console.error('Error in /status:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// [GET] /users-locations - 全ユーザーの最新位置情報を取得（位置情報許可設定を考慮）
app.get('/users-locations', authenticateToken, async (req, res) => {
    try {
        // 各ユーザーの最新の位置情報と称号計算に必要な情報を取得（位置情報許可が有効なユーザーのみ）
        const locationsQuery = `
      SELECT DISTINCT ON (u.id)
        u.id,
        u.username,
        u.score,
        u.gender,
        ST_X(l.geom) as longitude,
        ST_Y(l.geom) as latitude,
        l.weather,
        l.recorded_at
      FROM users u
      JOIN locations l ON u.id = l.user_id
      JOIN user_settings s ON u.id = s.user_id
      WHERE s.location_enabled = true
      ORDER BY u.id, l.recorded_at DESC
    `;

        const result = await pool.query(locationsQuery);

        const currentUserId = req.user.id; // 現在のユーザーIDを取得

        const userLocations = result.rows.map(row => {
            const totalScore = row.score !== null ? parseFloat(row.score) : 0;
            const gender = row.gender;

            // スコアに応じた称号を決定（genderで晴れ/雨の呼称を出し分け）
            let status = '凡人';
            if (totalScore > 500) {
                status = '太陽神';
            } else if (totalScore > 100) {
                status = (gender === 'female') ? '晴れ女' : '晴れ男';
            } else if (totalScore < -500) {
                status = '嵐を呼ぶ者';
            } else if (totalScore < -100) {
                status = (gender === 'female') ? '雨女' : '雨男';
            }

            return {
                id: row.id,
                username: row.username,
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude),
                weather: row.weather,
                recordedAt: row.recorded_at,
                status: status,  // 称号を追加
                score: totalScore,  // スコアも追加（デバッグ用）
                isCurrentUser: row.id === currentUserId  // 現在のユーザーかどうかのフラグを追加
            };
        });

        res.json({
            success: true,
            users: userLocations
        });

    } catch (error) {
        console.error('ユーザー位置情報取得エラー:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// [GET] /ranking - Get user rankings with different types
app.get('/ranking', authenticateToken, async (req, res) => {
    try {
        const { type = 'weather', limit = 50 } = req.query;
        const userId = req.user.id;

        let rankingQuery;
        let scoreColumn;

        switch (type) {
            case 'weather':
                // 天気スコアランキング
                rankingQuery = `
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
                    FROM users u
                    LEFT JOIN locations l ON u.id = l.user_id
                    GROUP BY u.id, u.username
                    ORDER BY score DESC
                `;
                scoreColumn = 'score';
                break;

            case 'missed':
                // 電車乗り遅れランキング（少ないほど上位）
                rankingQuery = `
                    SELECT
                        u.id,
                        u.username,
                        COALESCE(u.missed_train_count, 0) AS score
                    FROM users u
                    ORDER BY score ASC
                `;
                scoreColumn = 'score';
                break;

            case 'delay':
                // 電車遅延率ランキング（計算が必要）
                rankingQuery = `
                    SELECT
                        u.id,
                        u.username,
                        CASE
                            WHEN COALESCE(u.missed_train_count, 0) = 0 THEN 0
                            ELSE ROUND(
                                (COALESCE(u.missed_train_count, 0) * 100.0) /
                                GREATEST(COUNT(l.id), 1), 2
                            )
                        END AS score
                    FROM users u
                    LEFT JOIN locations l ON u.id = l.user_id
                    GROUP BY u.id, u.username, u.missed_train_count
                    ORDER BY score ASC
                `;
                scoreColumn = 'score';
                break;

            default:
                return res.status(400).json({ message: '無効なランキングタイプです' });
        }

        // ランキングを取得
        const rankingResult = await pool.query(rankingQuery);

        // 順位を付与
        const rankings = rankingResult.rows.map((row, index) => ({
            rank: index + 1,
            id: row.id,
            username: row.username,
            score: parseFloat(row.score) || 0,
            isCurrentUser: row.id === userId
        }));

        // 上位N名を取得
        const topRankings = rankings.slice(0, parseInt(limit));

        // 自分の順位を取得（上位に含まれていない場合）
        let currentUserRank = null;
        const currentUserInTop = topRankings.find(r => r.isCurrentUser);
        if (!currentUserInTop) {
            currentUserRank = rankings.find(r => r.isCurrentUser);
        }

        res.json({
            type: type,
            rankings: topRankings,
            currentUserRank: currentUserRank,
            totalUsers: rankings.length
        });

    } catch (error) {
        console.error('Error in /ranking endpoint:', error);
        res.status(500).json({
            message: 'ランキングの取得中にエラーが発生しました',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
            return res.status(400).json({ message: '性別はmale、femaleのいずれかを選択してください' });
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


// ===== ユーザー設定関連API =====

// GET /user/settings - ユーザー設定を取得
app.get('/user/settings', authenticateToken, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT notification_enabled, location_enabled, introduction_text
            FROM user_settings
            WHERE user_id = $1
        `, [req.user.id]);

        client.release();

        if (result.rows.length === 0) {
            // 設定が存在しない場合はデフォルト値を返す
            return res.json({
                notification_enabled: true,
                location_enabled: false,
                introduction_text: ''
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in /user/settings GET:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// PUT /user/settings - ユーザー設定を保存
app.put('/user/settings', authenticateToken, async (req, res) => {
    try {
        const { notification_enabled, location_enabled, introduction_text } = req.body;

        const client = await pool.connect();

        // UPSERT操作（存在しない場合はINSERT、存在する場合はUPDATE）
        await client.query(`
            INSERT INTO user_settings (user_id, notification_enabled, location_enabled, introduction_text, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id)
            DO UPDATE SET
                notification_enabled = EXCLUDED.notification_enabled,
                location_enabled = EXCLUDED.location_enabled,
                introduction_text = EXCLUDED.introduction_text,
                updated_at = CURRENT_TIMESTAMP
        `, [req.user.id, notification_enabled, location_enabled, introduction_text]);

        client.release();

        res.json({ message: '設定が保存されました' });
    } catch (error) {
        console.error('Error in /user/settings PUT:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// POST /user/icon - ユーザーアイコンを保存
app.post('/user/icon', authenticateToken, async (req, res) => {
    try {
        const { icon_data, content_type, file_size } = req.body;

        if (!icon_data) {
            return res.status(400).json({ message: 'アイコンデータが必要です' });
        }

        const client = await pool.connect();

        // UPSERT操作
        await client.query(`
            INSERT INTO user_icons (user_id, icon_data, content_type, file_size, uploaded_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id)
            DO UPDATE SET
                icon_data = EXCLUDED.icon_data,
                content_type = EXCLUDED.content_type,
                file_size = EXCLUDED.file_size,
                uploaded_at = CURRENT_TIMESTAMP
        `, [req.user.id, icon_data, content_type || 'image/jpeg', file_size]);

        client.release();

        res.json({ message: 'アイコンが保存されました' });
    } catch (error) {
        console.error('Error in /user/icon POST:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// GET /user/icon - ユーザーアイコンを取得
app.get('/user/icon', authenticateToken, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT icon_data, content_type
            FROM user_icons
            WHERE user_id = $1
        `, [req.user.id]);

        client.release();

        if (result.rows.length === 0) {
            // アイコン未設定時は 204 No Content を返す（フロントで静かに無視させる）
            return res.status(204).end();
        }

        const icon = result.rows[0];
        res.setHeader('Content-Type', icon.content_type);
        res.send(Buffer.from(icon.icon_data, 'base64'));
    } catch (error) {
        console.error('Error in /user/icon GET:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

// GET /user/info - ユーザー情報を取得
app.get('/user/info', authenticateToken, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT id, username, email, gender
            FROM users
            WHERE id = $1
        `, [req.user.id]);

        client.release();

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'ユーザーが見つかりません' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in /user/info GET:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
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