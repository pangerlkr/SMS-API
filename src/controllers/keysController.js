'use strict';

const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const { run, get, all } = require('../db');

/**
 * Generate a secure random API key prefixed with "smsapi_".
 */
function generateKeyValue() {
  const part1 = uuidv4().replace(/-/g, '');
  const part2 = uuidv4().replace(/-/g, '');
  return `smsapi_${part1}${part2}`;
}

/**
 * POST /api/keys
 * Body: { name }
 * Generate a new API key for the authenticated user.
 */
function createKey(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name } = req.body;
  const userId = req.user.id;
  const id = uuidv4();
  const keyValue = generateKeyValue();

  run(
    'INSERT INTO api_keys (id, user_id, key_value, name) VALUES (?, ?, ?, ?)',
    [id, userId, keyValue, name]
  );

  return res.status(201).json({
    message: 'API key created',
    api_key: {
      id,
      name,
      key_value: keyValue,
      created_at: new Date().toISOString()
    },
    warning: 'Store this key securely. It will not be shown in full again.'
  });
}

/**
 * GET /api/keys
 * List all API keys for the authenticated user (key_value masked).
 */
function listKeys(req, res) {
  const rows = all(
    'SELECT id, name, active, last_used_at, created_at, SUBSTR(key_value, 1, 14) || \'...\' AS key_preview FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  return res.json({ api_keys: rows });
}

/**
 * DELETE /api/keys/:id
 * Revoke (deactivate) an API key.
 */
function revokeKey(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const key = get('SELECT id FROM api_keys WHERE id = ? AND user_id = ?', [id, userId]);
  if (!key) {
    return res.status(404).json({ error: 'API key not found' });
  }

  run('UPDATE api_keys SET active = 0 WHERE id = ?', [id]);
  return res.json({ message: 'API key revoked' });
}

module.exports = { createKey, listKeys, revokeKey };
