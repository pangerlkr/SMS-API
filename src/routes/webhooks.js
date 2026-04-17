'use strict';

const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const { run, get, all } = require('../db');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateJWT);

const createWebhookValidation = [
  body('sim_card_id').notEmpty().isUUID().withMessage('sim_card_id must be a valid UUID'),
  body('endpoint_url').isURL().withMessage('endpoint_url must be a valid URL'),
  body('secret').optional().isLength({ min: 8 }).withMessage('secret must be at least 8 characters')
];

/**
 * POST /api/webhooks
 * Register a webhook URL for a SIM card (companion app endpoint).
 */
router.post('/', createWebhookValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { sim_card_id, endpoint_url, secret } = req.body;
  const userId = req.user.id;

  const sim = get(
    'SELECT id FROM sim_cards WHERE id = ? AND user_id = ? AND verified = 1 AND active = 1',
    [sim_card_id, userId]
  );
  if (!sim) {
    return res.status(400).json({
      error: 'SIM card not found, not verified, or not active'
    });
  }

  const id = uuidv4();
  const webhookSecret = secret || uuidv4();

  // Replace any existing webhook for this SIM
  run('DELETE FROM webhooks WHERE sim_card_id = ? AND user_id = ?', [sim_card_id, userId]);
  run(
    'INSERT INTO webhooks (id, user_id, sim_card_id, endpoint_url, secret) VALUES (?, ?, ?, ?, ?)',
    [id, userId, sim_card_id, endpoint_url, webhookSecret]
  );

  return res.status(201).json({
    message: 'Webhook registered',
    webhook: { id, sim_card_id, endpoint_url, secret: webhookSecret }
  });
});

/**
 * GET /api/webhooks
 * List webhooks for the authenticated user.
 */
router.get('/', (req, res) => {
  const rows = all(
    'SELECT w.id, w.sim_card_id, w.endpoint_url, w.active, w.created_at, sc.phone_number FROM webhooks w JOIN sim_cards sc ON sc.id = w.sim_card_id WHERE w.user_id = ? ORDER BY w.created_at DESC',
    [req.user.id]
  );
  return res.json({ webhooks: rows });
});

/**
 * DELETE /api/webhooks/:id
 * Remove a webhook.
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const wh = get('SELECT id FROM webhooks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!wh) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  run('DELETE FROM webhooks WHERE id = ?', [id]);
  return res.json({ message: 'Webhook deleted' });
});

module.exports = router;
