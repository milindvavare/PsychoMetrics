const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const candidateAuthController = require('../controllers/candidateAuthController');
const { authenticateCandidate } = require('../middleware/candidateAuth');

// Rate limiting - Login route (more lenient to allow multiple attempts)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 login attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/register', candidateAuthController.register);
router.post('/login', loginLimiter, candidateAuthController.login); // Apply rate limiter to login
router.get('/verify-setup-token/:token', candidateAuthController.verifySetupToken);
router.post('/setup-password', candidateAuthController.setupPassword);

// Protected routes
router.get('/me', authenticateCandidate, candidateAuthController.getCurrentCandidate);
router.get('/tests', authenticateCandidate, candidateAuthController.getAvailableTests);

module.exports = router;

