'use strict';

const express = require('express');
const { body } = require('express-validator');
const { createKey, listKeys, revokeKey } = require('../controllers/keysController');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// All key management routes require JWT auth
router.use(authenticateJWT);

const createKeyValidation = [
  body('name').trim().notEmpty().withMessage('Key name is required')
];

router.post('/', createKeyValidation, createKey);
router.get('/', listKeys);
router.delete('/:id', revokeKey);

module.exports = router;
