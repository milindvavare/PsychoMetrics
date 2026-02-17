const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active
    const [users] = await db.pool.execute(
      'SELECT id, company_id, email, role, status FROM users WHERE id = ? AND status = ?',
      [decoded.userId, 'active']
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = users[0];
    req.companyId = users[0].company_id;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Check if user has required role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    next();
  };
};

// Verify company access (for multi-tenant)
const verifyCompanyAccess = async (req, res, next) => {
  try {
    const companyId = req.params.companyId || req.body.company_id || req.query.company_id;
    
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company ID required' });
    }

    // Super admin can access any company
    if (req.user.role === 'super_admin') {
      req.companyId = parseInt(companyId);
      return next();
    }

    // Regular users can only access their own company
    if (req.user.company_id !== parseInt(companyId)) {
      return res.status(403).json({ success: false, message: 'Access denied to this company' });
    }

    req.companyId = parseInt(companyId);
    next();
  } catch (error) {
    logger.error('Company access verification error:', error);
    return res.status(500).json({ success: false, message: 'Error verifying company access' });
  }
};

module.exports = {
  authenticate,
  authorize,
  verifyCompanyAccess
};

