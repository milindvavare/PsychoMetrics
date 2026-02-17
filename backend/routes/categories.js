const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategory);
router.post('/', authorize('admin', 'super_admin', 'hr'), categoryController.createCategory);
router.put('/:id', authorize('admin', 'super_admin', 'hr'), categoryController.updateCategory);
router.delete('/:id', authorize('admin', 'super_admin'), categoryController.deleteCategory);

module.exports = router;

