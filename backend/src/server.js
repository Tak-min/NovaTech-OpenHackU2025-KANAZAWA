const app = require('./app');
const pool = require('./db/pool');
const { env, validateRequiredEnv } = require('./config/env');
const { initDb } = require('./db/init');

let server;

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await pool.end();
        console.log('Database pool closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error during database pool closure:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

const start = async () => {
  validateRequiredEnv();
  await initDb();
  await pool.query('SELECT 1');

  server = app.listen(env.port, () => {
    console.log(`SoraLog API listening on port ${env.port}`);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  console.error('Failed to start SoraLog API:', error.message);
  process.exit(1);
});
