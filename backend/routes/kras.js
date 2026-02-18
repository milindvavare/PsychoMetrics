const express = require('express');
const router = express.Router();
const kraController = require('../controllers/kraController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all KRAs
router.get('/', kraController.getKRAs);

// Get single KRA
router.get('/:id', kraController.getKRA);

// Create KRA (admin, hr only)
router.post('/', authorize('admin', 'super_admin', 'hr'), kraController.createKRA);

// Update KRA (admin, hr only)
router.put('/:id', authorize('admin', 'super_admin', 'hr'), kraController.updateKRA);

// Delete KRA (admin, super_admin only)
router.delete('/:id', authorize('admin', 'super_admin'), kraController.deleteKRA);

// Assign KRA to employee/candidate
router.post('/assign', authorize('admin', 'super_admin', 'hr'), kraController.assignKRA);

// Get employee KRAs
router.get('/employee/:employee_type/:employee_id', kraController.getEmployeeKRAs);

// Debug: Recalculate KRA/KPI for an attempt
const kraKpiController = require('../controllers/kraKpiController');
router.post('/recalculate/:attempt_id', authorize('admin', 'super_admin', 'hr'), kraKpiController.recalculateKRAKPI);
router.get('/calculation-status/:attempt_id', authorize('admin', 'super_admin', 'hr'), kraKpiController.getCalculationStatus);

module.exports = router;

