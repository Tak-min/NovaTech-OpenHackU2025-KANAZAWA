const express = require("express");
require("dotenv").config();
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

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
        console.log('tables created succussfully or already exist.');
    }catch(err){
        console.error("error creating tables:", err.stack);
    }finally{
        client.release();
    }
};


app.listen(PORT, async () => {
    console.log("server us running on port ${PORT}");

    try {
        const client = await pool.connect();
        console.log("database connection successful!");
        client.release();

        await createTables();
    }catch(err){
        console.error("database connection error:", err.stack);
    }
});


app.get('/', async (req,res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        res.send('hello world! DB time is: ${result.rows[0].now}');
        client.release();
    }catch(err){
        res.status(500).send('database connection error');
    }
});