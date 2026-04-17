'use strict';

const express = require('express');
const { body } = require('express-validator');
const { registerSim, verifySim, listSims, removeSim } = require('../controllers/simController');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// All SIM routes require JWT auth
router.use(authenticateJWT);

const registerSimValidation = [
  body('phone_number')
    .trim()
    .notEmpty()
    .withMessage('phone_number is required'),
  body('label').optional().trim()
];

const verifySimValidation = [
  body('sim_card_id').notEmpty().withMessage('sim_card_id is required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('otp must be a 6-digit number')
];

router.post('/register', registerSimValidation, registerSim);
router.post('/verify', verifySimValidation, verifySim);
router.get('/', listSims);
router.delete('/:id', removeSim);

module.exports = router;
