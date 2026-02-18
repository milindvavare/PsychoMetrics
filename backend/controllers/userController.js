const db = require('../config/database');
const logger = require('../utils/logger');

// Get all users for a company
const getUsers = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { search, role, status } = req.query;

    let query = 'SELECT id, email, first_name, last_name, role, status, created_at FROM users WHERE company_id = ?';
    const params = [companyId];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    const users = await db.query(query, params);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

module.exports = {
  getUsers
};

