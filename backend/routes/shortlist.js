const express = require('express');
const router = express.Router();
const shortlistController = require('../controllers/shortlistController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/test/:test_id/generate', authorize('admin', 'super_admin', 'hr'), shortlistController.generateShortlist);
router.get('/test/:test_id', shortlistController.getShortlist);

module.exports = router;

