const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/interpret/:attempt_id', aiController.generateInterpretation);
router.get('/interpret/:attempt_id', aiController.getInterpretation);

module.exports = router;

