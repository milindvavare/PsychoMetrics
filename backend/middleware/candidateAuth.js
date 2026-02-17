const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

// Verify candidate JWT token
const authenticateCandidate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify it's a candidate token
    if (decoded.type !== 'candidate') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    // Verify candidate still exists and is active
    const [candidates] = await db.pool.execute(
      'SELECT id, company_id, email, first_name, last_name, status FROM candidates WHERE id = ?',
      [decoded.candidateId]
    );

    if (candidates.length === 0) {
      return res.status(401).json({ success: false, message: 'Candidate not found' });
    }

    const candidate = candidates[0];

    if (candidate.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Candidate account is inactive or blocked' });
    }

    req.candidate = candidate;
    req.companyId = candidate.company_id;
    next();
  } catch (error) {
    logger.error('Candidate authentication error:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = {
  authenticateCandidate
};

