const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/attemptController');
const { authenticate } = require('../middleware/auth');
const { authenticateCandidate } = require('../middleware/candidateAuth');
const { logIPAddress } = require('../middleware/antiCheat');

// Allow both admin and candidate authentication for starting attempts
const authenticateAttempt = async (req, res, next) => {
  // Try candidate auth first
  const candidateToken = req.headers.authorization?.split(' ')[1];
  if (candidateToken) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(candidateToken, process.env.JWT_SECRET);
      if (decoded.type === 'candidate') {
        return authenticateCandidate(req, res, next);
      }
    } catch (error) {
      // Not a candidate token, try admin auth
    }
  }
  // Fall back to admin auth
  return authenticate(req, res, next);
};

// Start attempt can be accessed by both candidates and admins
router.post('/start', authenticateAttempt, logIPAddress, attemptController.startAttempt);

// Answer and submit can be accessed by candidates during test
router.post('/answer', authenticateAttempt, attemptController.submitAnswer);
router.post('/submit', authenticateAttempt, attemptController.submitAttempt);
router.post('/track-tab', authenticateAttempt, attemptController.trackTabSwitch);

// View attempt details - allow both candidate (their own) and admin
router.get('/:id', authenticateAttempt, attemptController.getAttempt);

module.exports = router;

