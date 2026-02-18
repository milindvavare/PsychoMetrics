const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all KPIs
router.get('/', kpiController.getKPIs);

// Get single KPI
router.get('/:id', kpiController.getKPI);

// Create KPI (admin, hr only)
router.post('/', authorize('admin', 'super_admin', 'hr'), kpiController.createKPI);

// Update KPI (admin, hr only)
router.put('/:id', authorize('admin', 'super_admin', 'hr'), kpiController.updateKPI);

// Delete KPI (admin, super_admin only)
router.delete('/:id', authorize('admin', 'super_admin'), kpiController.deleteKPI);

// Submit KPI Performance
router.post('/performance', kpiController.submitKPIPerformance);

// Get KPI Performance
router.get('/performance/:employee_type/:employee_id', kpiController.getKPIPerformance);

// Review (Approve/Reject) KPI Performance
router.put('/performance/:id/review', authorize('admin', 'super_admin', 'hr'), kpiController.reviewKPIPerformance);

module.exports = router;



