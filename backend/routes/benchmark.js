const express = require('express');
const router = express.Router();
const benchmarkController = require('../controllers/benchmarkController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/attempt/:attempt_id', benchmarkController.getBenchmarkComparison);
router.get('/', benchmarkController.getBenchmarks);
router.post('/', authorize('admin', 'super_admin', 'hr'), benchmarkController.createBenchmark);

module.exports = router;

