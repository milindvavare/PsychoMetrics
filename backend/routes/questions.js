const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', questionController.getQuestions);
router.get('/:id', questionController.getQuestion);
router.post('/', authorize('admin', 'super_admin', 'hr'), questionController.createQuestion);
router.put('/:id', authorize('admin', 'super_admin', 'hr'), questionController.updateQuestion);
router.delete('/:id', authorize('admin', 'super_admin'), questionController.deleteQuestion);
router.post('/test/add', authorize('admin', 'super_admin', 'hr'), questionController.addQuestionToTest);
router.delete('/test/:test_id/:question_id', authorize('admin', 'super_admin', 'hr'), questionController.removeQuestionFromTest);

module.exports = router;

