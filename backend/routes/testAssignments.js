const express = require('express');
const router = express.Router();
const testAssignmentController = require('../controllers/testAssignmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { authenticateCandidate } = require('../middleware/candidateAuth');

// Admin routes
router.use(authenticate);

router.post('/assign', authorize('admin', 'super_admin', 'hr'), testAssignmentController.assignTest);
router.get('/test/:testId', authorize('admin', 'super_admin', 'hr'), testAssignmentController.getTestAssignments);
router.delete('/:assignmentId', authorize('admin', 'super_admin', 'hr'), testAssignmentController.removeAssignment);

// Candidate route (can be accessed by candidate or admin)
router.get('/candidate/:candidateId', async (req, res, next) => {
  // Check if it's a candidate accessing their own assignments
  const candidateToken = req.headers.authorization?.split(' ')[1];
  if (candidateToken) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(candidateToken, process.env.JWT_SECRET);
      if (decoded.type === 'candidate' && decoded.candidateId.toString() === req.params.candidateId) {
        return authenticateCandidate(req, res, next);
      }
    } catch (error) {
      // Not a candidate token, continue to admin auth
    }
  }
  // Otherwise, require admin auth
  return authenticate(req, res, next);
}, testAssignmentController.getCandidateAssignments);

module.exports = router;

