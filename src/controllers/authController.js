'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const { run, get } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;

  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  run(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
    [id, name, email, password_hash]
  );

  const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.status(201).json({
    message: 'User registered successfully',
    token,
    user: { id, name, email }
  });
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

  return res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
}

/**
 * GET /api/auth/profile
 */
function profile(req, res) {
  const user = get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
}

module.exports = { register, login, profile };
