'use strict';

const express = require('express');
const { body } = require('express-validator');
const { sendSms, updateStatus, getLogs } = require('../controllers/smsController');
const { authenticateApiKey } = require('../middleware/apiKey');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

const sendSmsValidation = [
  body('to')
    .trim()
    .notEmpty()
    .withMessage('to (recipient number) is required'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('message is required')
    .isLength({ max: 1600 })
    .withMessage('message must be 1600 characters or fewer'),
  body('sim_card_id').optional().isUUID().withMessage('sim_card_id must be a valid UUID')
];

const updateStatusValidation = [
  body('log_id').notEmpty().withMessage('log_id is required'),
  body('status').notEmpty().withMessage('status is required'),
  body('error_message').optional().isString()
];

// Send SMS – authenticated via API key
router.post('/send', authenticateApiKey, sendSmsValidation, sendSms);

// Companion device status callback – authenticated via API key
router.post('/status', authenticateApiKey, updateStatusValidation, updateStatus);

// View logs – supports both JWT and API key auth
router.get('/logs', authenticateJWT, getLogs);

module.exports = router;
