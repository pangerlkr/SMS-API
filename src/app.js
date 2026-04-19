'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const simRoutes = require('./routes/sim');
const keysRoutes = require('./routes/keys');
const smsRoutes = require('./routes/sms');
const webhookRoutes = require('./routes/webhooks');
const { getDb } = require('./db');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

const app = express();

// Security headers – relax CSP to allow the UI's self-hosted scripts/styles
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"]
      }
    }
  })
);

// CORS – configurable via CORS_ORIGIN env var
const corsOrigin = process.env.CORS_ORIGIN || (IS_PRODUCTION ? false : '*');
app.use(cors({ origin: corsOrigin }));

// Serve web UI static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging (skip in test environment)
if (NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Rate limiting – global: 100 req / 15 min per IP (skipped in test environment)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST
});
app.use(limiter);

// Stricter rate limit for auth endpoints – 10 attempts / 15 min per IP (skipped in test environment)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => IS_TEST,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/sim', simRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check – verifies DB is reachable
app.get('/health', (_req, res) => {
  try {
    getDb().exec('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// Root – belt-and-suspenders fallback in case express.static misses it
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler – never expose stack traces in production
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (IS_PRODUCTION) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } else {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error', stack: err.stack });
  }
});

module.exports = app;
