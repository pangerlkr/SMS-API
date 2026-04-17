'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const simRoutes = require('./routes/sim');
const keysRoutes = require('./routes/keys');
const smsRoutes = require('./routes/sms');
const webhookRoutes = require('./routes/webhooks');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting – 100 req / 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sim', simRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
