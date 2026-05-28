const app = require('./app');
const pool = require('./db/pool');
const { env, validateRequiredEnv } = require('./config/env');
const { initDb } = require('./db/init');

const start = async () => {
  validateRequiredEnv();
  await initDb();
  await pool.query('SELECT 1');

  app.listen(env.port, () => {
    console.log(`SoraLog API listening on port ${env.port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start SoraLog API:', error.message);
  process.exit(1);
});
