const express = require('express');
const router = express.Router();
const candidateAuthController = require('../controllers/candidateAuthController');
const { authenticateCandidate } = require('../middleware/candidateAuth');

// Public routes
router.post('/register', candidateAuthController.register);
router.post('/login', candidateAuthController.login);
router.get('/verify-setup-token/:token', candidateAuthController.verifySetupToken);
router.post('/setup-password', candidateAuthController.setupPassword);

// Protected routes
router.get('/me', authenticateCandidate, candidateAuthController.getCurrentCandidate);
router.get('/tests', authenticateCandidate, candidateAuthController.getAvailableTests);

module.exports = router;

