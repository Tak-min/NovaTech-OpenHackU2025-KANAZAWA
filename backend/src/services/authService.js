const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const userRepository = require('../repositories/userRepository');
const settingsRepository = require('../repositories/settingsRepository');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_GENDERS = new Set(['male', 'female', 'other', 'unspecified', 'prefer_not_to_say']);

const createToken = (user) => jwt.sign(
  {
    id: user.id,
    username: user.username
  },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn }
);

const normalizeRegistration = ({ username, email, password, gender } = {}) => {
  const normalized = {
    username: String(username || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
    gender: gender ? String(gender) : 'unspecified'
  };

  const errors = [];
  if (normalized.username.length < 3 || normalized.username.length > 50) {
    errors.push({ field: 'username', message: 'ユーザー名は3文字以上50文字以下で入力してください' });
  }
  if (!EMAIL_PATTERN.test(normalized.email)) {
    errors.push({ field: 'email', message: '有効なメールアドレスを入力してください' });
  }
  if (normalized.password.length < 6) {
    errors.push({ field: 'password', message: 'パスワードは6文字以上で入力してください' });
  }
  if (!VALID_GENDERS.has(normalized.gender)) {
    errors.push({ field: 'gender', message: 'ラベル設定が不正です' });
  }

  if (errors.length > 0) {
    throw new AppError('入力内容を確認してください', 400, 'VALIDATION_ERROR', errors);
  }

  return normalized;
};

const normalizeLogin = ({ email, password, username } = {}) => {
  const identifier = String(email || username || '').trim();
  const normalized = {
    identifier,
    password: String(password || '')
  };

  const errors = [];
  if (!normalized.identifier) {
    errors.push({ field: 'email', message: 'メールアドレスまたはユーザー名を入力してください' });
  }
  if (!normalized.password) {
    errors.push({ field: 'password', message: 'パスワードを入力してください' });
  }

  if (errors.length > 0) {
    throw new AppError('入力内容を確認してください', 400, 'VALIDATION_ERROR', errors);
  }

  return normalized;
};

const register = async (input) => {
  const normalized = normalizeRegistration(input);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingEmail = await userRepository.findByEmail(normalized.email, client);
    if (existingEmail) {
      throw new AppError('このメールアドレスは登録済みです', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const existingUsername = await userRepository.findByUsername(normalized.username, client);
    if (existingUsername) {
      throw new AppError('このユーザー名はすでに使われています', 409, 'USERNAME_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(normalized.password, 10);
    const user = await userRepository.createUser({
      username: normalized.username,
      email: normalized.email,
      passwordHash,
      gender: normalized.gender
    }, client);

    await settingsRepository.ensureForUser(user.id, client);
    await client.query('COMMIT');

    const publicUser = userRepository.toPublicUser(user);
    return {
      token: createToken(publicUser),
      user: publicUser
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new AppError('メールアドレスまたはユーザー名が登録済みです', 409, 'DUPLICATE_USER');
    }
    throw error;
  } finally {
    client.release();
  }
};

const login = async (input) => {
  const normalized = normalizeLogin(input);
  const user = await userRepository.findByLoginIdentifier(normalized.identifier);

  if (!user) {
    throw new AppError('メールアドレスまたはパスワードが正しくありません', 401, 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await bcrypt.compare(normalized.password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError('メールアドレスまたはパスワードが正しくありません', 401, 'INVALID_CREDENTIALS');
  }

  const publicUser = userRepository.toPublicUser(user);
  return {
    token: createToken(publicUser),
    user: publicUser
  };
};

module.exports = {
  register,
  login
};
