const pool = require('../db/pool');

const query = (db, text, params) => db.query(text, params);

/**
 * ユーザー行を公開用オブジェクトに変換。
 * email等のプライベート情報は含めない。
 */
const toPublicUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    gender: row.gender || 'unspecified',
    score: Number(row.score || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

/**
 * 認証内部用: email等を含む完全なユーザー情報
 */
const toAuthUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    gender: row.gender || 'unspecified',
    score: Number(row.score || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const findByEmail = async (email, db = pool) => {
  const result = await query(
    db,
    `SELECT id, username, email, password_hash, gender, score, created_at, updated_at
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
};

const findByUsername = async (username, db = pool) => {
  const result = await query(
    db,
    `SELECT id, username, email, password_hash, gender, score, created_at, updated_at
     FROM users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
};

const findByLoginIdentifier = async (identifier, db = pool) => {
  const result = await query(
    db,
    `SELECT id, username, email, password_hash, gender, score, created_at, updated_at
     FROM users
     WHERE LOWER(email) = LOWER($1)
        OR LOWER(username) = LOWER($1)
     ORDER BY CASE WHEN LOWER(email) = LOWER($1) THEN 0 ELSE 1 END
     LIMIT 1`,
    [identifier]
  );
  return result.rows[0] || null;
};

const findById = async (userId, db = pool) => {
  const result = await query(
    db,
    `SELECT id, username, email, gender, score, created_at, updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

const createUser = async ({ username, email, passwordHash, gender }, db = pool) => {
  const result = await query(
    db,
    `INSERT INTO users (username, email, password_hash, gender, score, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
     RETURNING id, username, email, gender, score, created_at, updated_at`,
    [username, email, passwordHash, gender]
  );
  return result.rows[0];
};

const addScore = async (userId, scoreDelta, db = pool) => {
  const result = await query(
    db,
    `UPDATE users
     SET score = COALESCE(score, 0) + $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, username, email, gender, score, created_at, updated_at`,
    [scoreDelta, userId]
  );
  return result.rows[0] || null;
};

module.exports = {
  toPublicUser,
  toAuthUser,
  findByEmail,
  findByUsername,
  findByLoginIdentifier,
  findById,
  createUser,
  addScore
};
