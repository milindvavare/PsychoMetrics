const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const { authenticate, authorize } = require('../middleware/auth');
const { authenticateCandidate } = require('../middleware/candidateAuth');

// Middleware to allow both admin and candidate authentication for viewing tests
const authenticateTestAccess = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'candidate') {
      return authenticateCandidate(req, res, next);
    } else {
      return authenticate(req, res, next);
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Get all tests (admin only)
router.get('/', authenticate, testController.getTests);

// Get single test (accessible by both admin and candidate)
router.get('/:id', authenticateTestAccess, testController.getTest);

// Create test (admin only) - authenticate first, then authorize
router.post('/', authenticate, authorize('admin', 'super_admin', 'hr'), testController.createTest);

// Update test (admin only) - authenticate first, then authorize
router.put('/:id', authenticate, authorize('admin', 'super_admin', 'hr'), testController.updateTest);

// Delete test (admin only) - authenticate first, then authorize
router.delete('/:id', authenticate, authorize('admin', 'super_admin'), testController.deleteTest);

module.exports = router;

