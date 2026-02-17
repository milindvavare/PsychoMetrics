const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', candidateController.getCandidates);
router.get('/:id', candidateController.getCandidate);
router.post('/', authorize('admin', 'super_admin', 'hr'), candidateController.createCandidate);
router.put('/:id', authorize('admin', 'super_admin', 'hr'), candidateController.updateCandidate);
router.delete('/:id', authorize('admin', 'super_admin', 'hr'), candidateController.deleteCandidate);

module.exports = router;

