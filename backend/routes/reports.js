const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const comprehensiveReportController = require('../controllers/comprehensiveReportController');
const { authenticate } = require('../middleware/auth');
const { authenticateCandidate } = require('../middleware/candidateAuth');

// Allow both candidate (their own) and admin to download reports
const authenticateReportAccess = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'candidate') {
      // For candidates, verify it's their own attempt
      return authenticateCandidate(req, res, async () => {
        const { attempt_id } = req.params;
        const db = require('../config/database');
        const [attempts] = await db.pool.execute(
          'SELECT candidate_id FROM test_attempts WHERE id = ?',
          [attempt_id]
        );
        
        if (attempts.length === 0 || attempts[0].candidate_id !== req.candidate.id) {
          return res.status(403).json({
            success: false,
            message: 'You can only download your own test reports'
          });
        }
        next();
      });
    } else {
      return authenticate(req, res, next);
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

router.get('/attempt/:attempt_id/pdf', authenticateReportAccess, reportController.generatePDFReport);

// Comprehensive Reports
router.get('/hr-detailed/:attempt_id', authenticate, comprehensiveReportController.getHRDetailedReport);
router.get('/candidate-summary/:attempt_id', authenticateReportAccess, comprehensiveReportController.getCandidateSummaryReport);
router.get('/comparative/:test_id', authenticate, comprehensiveReportController.getComparativeReport);

module.exports = router;

