'use strict';

const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const { run, get, all } = require('../db');

/**
 * POST /api/sms/send
 * Authenticated via API key (X-API-Key header).
 * Body: { to, message, sim_card_id? }
 *
 * Routes the SMS through the user's registered & verified SIM card.
 * In production, delivery to the physical SIM is handled by the companion
 * mobile app (via webhook) or a connected GSM modem.
 */
function sendSms(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { to, message, sim_card_id } = req.body;
  const userId = req.user.id;
  const apiKeyId = req.apiKey.id;

  // Resolve which SIM card to use
  let sim;
  if (sim_card_id) {
    sim = get(
      'SELECT * FROM sim_cards WHERE id = ? AND user_id = ? AND verified = 1 AND active = 1',
      [sim_card_id, userId]
    );
    if (!sim) {
      return res.status(400).json({
        error: 'Specified SIM card not found, not verified, or not active'
      });
    }
  } else {
    // Use the first active verified SIM for this user
    sim = get(
      'SELECT * FROM sim_cards WHERE user_id = ? AND verified = 1 AND active = 1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );
    if (!sim) {
      return res.status(400).json({
        error: 'No verified SIM card found. Please register and verify a SIM card first.'
      });
    }
  }

  const logId = uuidv4();
  run(
    'INSERT INTO sms_logs (id, user_id, sim_card_id, api_key_id, to_number, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [logId, userId, sim.id, apiKeyId, to, message, 'queued']
  );

  // Dispatch via webhook if configured
  const webhook = get(
    'SELECT * FROM webhooks WHERE sim_card_id = ? AND active = 1',
    [sim.id]
  );

  if (webhook) {
    dispatchWebhook(webhook, { log_id: logId, to, message, from: sim.phone_number });
    run("UPDATE sms_logs SET status = 'dispatched', sent_at = datetime('now') WHERE id = ?", [logId]);
    return res.json({
      message: 'SMS dispatched to companion device',
      log_id: logId,
      from: sim.phone_number,
      to,
      status: 'dispatched'
    });
  }

  // No webhook registered – mark as pending_device
  run("UPDATE sms_logs SET status = 'pending_device' WHERE id = ?", [logId]);
  return res.json({
    message: 'SMS queued. Connect a companion device or register a webhook to complete delivery.',
    log_id: logId,
    from: sim.phone_number,
    to,
    status: 'pending_device'
  });
}

/**
 * POST /api/sms/status
 * Called by the companion device to report delivery status.
 * Authenticated via API key.
 * Body: { log_id, status, error_message? }
 */
function updateStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { log_id, status, error_message } = req.body;
  const userId = req.user.id;

  const allowed = ['sent', 'failed', 'delivered'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  const log = get('SELECT id FROM sms_logs WHERE id = ? AND user_id = ?', [log_id, userId]);
  if (!log) {
    return res.status(404).json({ error: 'SMS log not found' });
  }

  run(
    "UPDATE sms_logs SET status = ?, error_message = ?, sent_at = COALESCE(sent_at, datetime('now')) WHERE id = ?",
    [status, error_message || null, log_id]
  );

  return res.json({ message: 'Status updated', log_id, status });
}

/**
 * GET /api/sms/logs
 * Authenticated via JWT or API key.
 * Query params: page (default 1), limit (default 20, max 100)
 */
function getLogs(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const userId = req.user.id;

  const rows = all(
    'SELECT sl.id, sl.to_number, sl.message, sl.status, sl.error_message, sl.sent_at, sl.created_at, sc.phone_number AS from_number FROM sms_logs sl LEFT JOIN sim_cards sc ON sc.id = sl.sim_card_id WHERE sl.user_id = ? ORDER BY sl.created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );

  return res.json({ logs: rows, page, limit });
}

/**
 * Fire-and-forget HTTP POST to the registered webhook URL.
 * In production this would be queued in a job system with retries.
 */
function dispatchWebhook(webhook, payload) {
  const https = require('https');
  const http = require('http');
  const url = new URL(webhook.endpoint_url);

  const body = JSON.stringify({
    ...payload,
    webhook_id: webhook.id,
    timestamp: new Date().toISOString()
  });

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-SMS-API-Secret': webhook.secret
    }
  };

  const client = url.protocol === 'https:' ? https : http;
  const reqHttp = client.request(options, () => {});
  reqHttp.on('error', (err) => {
    console.error(`Webhook dispatch failed for webhook ${webhook.id}:`, err.message);
  });
  reqHttp.write(body);
  reqHttp.end();
}

module.exports = { sendSms, updateStatus, getLogs };
