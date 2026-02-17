const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/scoreController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/test/:test_id', scoreController.getTestScores);
router.get('/candidate/:candidate_id', scoreController.getCandidateScores);
router.get('/test/:test_id/statistics', scoreController.getScoreStatistics);

module.exports = router;

