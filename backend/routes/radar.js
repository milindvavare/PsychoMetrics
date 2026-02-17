const express = require('express');
const router = express.Router();
const radarController = require('../controllers/radarController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/attempt/:attempt_id', radarController.getRadarData);
router.get('/test/:test_id/comparative', radarController.getComparativeRadarData);

module.exports = router;

