const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

// Register new user
const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, company_id, role } = req.body;

    // Validate input
    if (!email || !password || !company_id) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and company_id are required'
      });
    }

    // Check if user already exists
    const [existingUsers] = await db.pool.execute(
      'SELECT id FROM users WHERE email = ? AND company_id = ?',
      [email, company_id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists for this company'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await db.pool.execute(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [company_id, email, passwordHash, first_name || null, last_name || null, role || 'viewer']
    );

    logger.info(`User registered: ${email} for company ${company_id}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user_id: result.insertId,
        email
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password, company_id } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    let query = 'SELECT * FROM users WHERE email = ?';
    let params = [email];

    if (company_id) {
      query += ' AND company_id = ?';
      params.push(company_id);
    }

    const [users] = await db.pool.execute(query, params);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await db.pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        companyId: user.company_id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Get company info
    const [companies] = await db.pool.execute(
      'SELECT id, name, domain, subscription_tier FROM companies WHERE id = ?',
      [user.company_id]
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          company_id: user.company_id,
          company: companies[0] || null
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const [users] = await db.pool.execute(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.company_id, 
              c.name as company_name, c.subscription_tier
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser
};

