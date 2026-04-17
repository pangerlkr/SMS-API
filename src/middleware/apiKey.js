'use strict';

const { get, run } = require('../db');

/**
 * Express middleware that validates an API key passed via the
 * X-API-Key header.  Attaches req.apiKey and req.user (userId) on success.
 */
function authenticateApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const record = get(
    'SELECT ak.*, u.id AS uid FROM api_keys ak JOIN users u ON u.id = ak.user_id WHERE ak.key_value = ? AND ak.active = 1',
    [key]
  );

  if (!record) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  // Update last_used_at
  run('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?', [record.id]);

  req.apiKey = record;
  req.user = { id: record.user_id };
  next();
}

module.exports = { authenticateApiKey };
