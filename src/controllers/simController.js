'use strict';

const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const { run, get, all } = require('../db');

/**
 * Generate a 6-digit OTP.
 */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/sim/register
 * Body: { phone_number, label? }
 * Registers an Indian SIM card and sends an OTP for verification.
 */
function registerSim(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { phone_number, label } = req.body;
  const userId = req.user.id;

  // Normalise Indian number: strip leading +91 or 0
  const normalised = normaliseIndianNumber(phone_number);
  if (!normalised) {
    return res.status(400).json({ error: 'Invalid Indian phone number' });
  }

  const existing = get(
    'SELECT id, verified FROM sim_cards WHERE user_id = ? AND phone_number = ?',
    [userId, normalised]
  );
  if (existing) {
    if (existing.verified) {
      return res.status(409).json({ error: 'Phone number already registered and verified' });
    }
    // Re-send OTP
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    run(
      "UPDATE sim_cards SET otp_code = ?, otp_expires_at = ? WHERE id = ?",
      [otp, expires, existing.id]
    );
    // In a real system the OTP would be delivered via SMS to the handset.
    // We return it in the response for development/testing purposes.
    return res.json({
      message: 'OTP resent. Please verify your SIM card.',
      sim_card_id: existing.id,
      otp_for_testing: otp
    });
  }

  const id = uuidv4();
  const otp = generateOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  run(
    'INSERT INTO sim_cards (id, user_id, phone_number, label, otp_code, otp_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, normalised, label || null, otp, expires]
  );

  return res.status(201).json({
    message: 'SIM card registered. Please verify using the OTP sent to your number.',
    sim_card_id: id,
    otp_for_testing: otp
  });
}

/**
 * POST /api/sim/verify
 * Body: { sim_card_id, otp }
 * Verifies SIM card ownership using the OTP.
 */
function verifySim(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { sim_card_id, otp } = req.body;
  const userId = req.user.id;

  const sim = get(
    'SELECT * FROM sim_cards WHERE id = ? AND user_id = ?',
    [sim_card_id, userId]
  );

  if (!sim) {
    return res.status(404).json({ error: 'SIM card not found' });
  }

  if (sim.verified) {
    return res.status(409).json({ error: 'SIM card already verified' });
  }

  if (!sim.otp_code || sim.otp_code !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  if (new Date(sim.otp_expires_at) < new Date()) {
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  run(
    "UPDATE sim_cards SET verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE id = ?",
    [sim_card_id]
  );

  return res.json({ message: 'SIM card verified successfully', sim_card_id });
}

/**
 * GET /api/sim
 * List all SIM cards for the authenticated user.
 */
function listSims(req, res) {
  const rows = all(
    'SELECT id, phone_number, label, verified, active, created_at FROM sim_cards WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  return res.json({ sim_cards: rows });
}

/**
 * DELETE /api/sim/:id
 * Deactivate (soft-delete) a SIM card.
 */
function removeSim(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const sim = get('SELECT id FROM sim_cards WHERE id = ? AND user_id = ?', [id, userId]);
  if (!sim) {
    return res.status(404).json({ error: 'SIM card not found' });
  }

  run('UPDATE sim_cards SET active = 0 WHERE id = ?', [id]);
  return res.json({ message: 'SIM card deactivated' });
}

/**
 * Normalise an Indian phone number to a 10-digit string.
 * Accepts formats: +91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 * Returns null if invalid.
 */
function normaliseIndianNumber(raw) {
  const stripped = raw.replace(/[\s\-().]/g, '');
  let digits = stripped;

  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Must be exactly 10 digits, starting with 6-9 (valid Indian mobile)
  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

module.exports = { registerSim, verifySim, listSims, removeSim, normaliseIndianNumber };
