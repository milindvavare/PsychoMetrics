const db = require('../config/database');
const logger = require('../utils/logger');

// Create company
const createCompany = async (req, res) => {
  try {
    const { name, domain, subscription_tier, settings } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    const [result] = await db.pool.execute(
      `INSERT INTO companies (name, domain, subscription_tier, settings)
       VALUES (?, ?, ?, ?)`,
      [
        name,
        domain || null,
        subscription_tier || 'free',
        settings ? JSON.stringify(settings) : null
      ]
    );

    logger.info(`Company created: ${result.insertId} - ${name}`);

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: { company_id: result.insertId }
    });
  } catch (error) {
    logger.error('Create company error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });
  }
};

// Get companies
const getCompanies = async (req, res) => {
  try {
    // Super admin can see all companies
    if (req.user.role === 'super_admin') {
      const companies = await db.query(
        'SELECT * FROM companies ORDER BY created_at DESC'
      );
      return res.json({
        success: true,
        data: companies
      });
    }

    // Regular users see only their company
    const [companies] = await db.pool.execute(
      'SELECT * FROM companies WHERE id = ?',
      [req.user.company_id]
    );

    res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    logger.error('Get companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching companies',
      error: error.message
    });
  }
};

// Get single company
const getCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify access
    if (req.user.role !== 'super_admin' && req.user.company_id !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [companies] = await db.pool.execute(
      'SELECT * FROM companies WHERE id = ?',
      [id]
    );

    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const company = companies[0];
    company.settings = company.settings 
      ? (typeof company.settings === 'string' ? JSON.parse(company.settings) : company.settings)
      : null;

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    logger.error('Get company error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error.message
    });
  }
};

module.exports = {
  createCompany,
  getCompanies,
  getCompany
};

