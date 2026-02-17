const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, companyController.getCompanies);
router.get('/:id', authenticate, companyController.getCompany);
// Allow public registration for companies
router.post('/', companyController.createCompany);

module.exports = router;

