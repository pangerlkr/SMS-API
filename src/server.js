'use strict';

require('dotenv').config();

// ---------------------------------------------------------------------------
// Validate required environment variables before doing anything else
// ---------------------------------------------------------------------------

const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is required in production.');
    process.exit(1);
  }
  if (process.env.JWT_SECRET === 'change_this_secret_in_production') {
    console.error('FATAL: JWT_SECRET must not use the default placeholder value in production.');
    process.exit(1);
  }
} else if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Using an insecure default. Set JWT_SECRET in production.');
}

// ---------------------------------------------------------------------------
// Unhandled rejection / exception safety net
// ---------------------------------------------------------------------------

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const { initDb } = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`SMS API server running on port ${PORT} [${NODE_ENV}]`);
    });

    // ---------------------------------------------------------------------------
    // Graceful shutdown – drain in-flight requests before exiting
    // ---------------------------------------------------------------------------

    function shutdown(signal) {
      console.log(`${signal} received. Shutting down gracefully…`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });

      // Force exit if server hasn't closed within 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10_000).unref();
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
