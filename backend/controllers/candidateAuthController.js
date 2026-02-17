const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Candidate Registration
const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, company_id } = req.body;

    if (!email || !password || !company_id) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and company_id are required'
      });
    }

    // Check if candidate already exists
    const [existingCandidates] = await db.pool.execute(
      'SELECT id FROM candidates WHERE email = ? AND company_id = ?',
      [email, company_id]
    );

    if (existingCandidates.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Candidate already exists for this company'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create candidate
    const [result] = await db.pool.execute(
      `INSERT INTO candidates (company_id, email, password_hash, first_name, last_name, phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        company_id,
        email,
        passwordHash,
        first_name || null,
        last_name || null,
        phone || null
      ]
    );

    logger.info(`Candidate registered: ${email} for company ${company_id}`);

    res.status(201).json({
      success: true,
      message: 'Candidate registered successfully',
      data: {
        candidate_id: result.insertId,
        email
      }
    });
  } catch (error) {
    logger.error('Candidate registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering candidate',
      error: error.message
    });
  }
};

// Candidate Login
const login = async (req, res) => {
  try {
    const { email, password, company_id } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find candidate
    let query = 'SELECT * FROM candidates WHERE email = ?';
    let params = [email];

    if (company_id) {
      query += ' AND company_id = ?';
      params.push(company_id);
    }

    const [candidates] = await db.pool.execute(query, params);

    if (candidates.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const candidate = candidates[0];

    // Check if password is set
    if (!candidate.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'Password not set. Please check your email for the setup link or contact administrator.'
      });
    }

    // Check if candidate is active
    if (candidate.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive or blocked. Please contact administrator.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, candidate.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        candidateId: candidate.id,
        companyId: candidate.company_id,
        email: candidate.email,
        type: 'candidate'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Get company info
    const [companies] = await db.pool.execute(
      'SELECT id, name, domain FROM companies WHERE id = ?',
      [candidate.company_id]
    );

    logger.info(`Candidate logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        candidate: {
          id: candidate.id,
          email: candidate.email,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          company_id: candidate.company_id,
          company: companies[0] || null
        }
      }
    });
  } catch (error) {
    logger.error('Candidate login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// Get current candidate
const getCurrentCandidate = async (req, res) => {
  try {
    const [candidates] = await db.pool.execute(
      `SELECT c.*, co.name as company_name
       FROM candidates c
       LEFT JOIN companies co ON c.company_id = co.id
       WHERE c.id = ?`,
      [req.candidate.id]
    );

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const candidate = candidates[0];
    // Remove password hash from response
    if (candidate.metadata) {
      const metadata = typeof candidate.metadata === 'string' 
        ? JSON.parse(candidate.metadata) 
        : candidate.metadata;
      delete metadata.password_hash;
      candidate.metadata = metadata;
    }

    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    logger.error('Get current candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate data',
      error: error.message
    });
  }
};

// Get available tests for candidate (only assigned tests)
const getAvailableTests = async (req, res) => {
  try {
    const candidateId = req.candidate.id;
    const companyId = req.candidate.company_id;

    // Get only assigned tests for the candidate
    // Count ALL attempts (including in_progress) to show accurate remaining attempts
    const tests = await db.query(
      `SELECT t.*, 
              ta.id as assignment_id,
              ta.assigned_at,
              ta.due_date,
              ta.status as assignment_status,
              ta.notes as assignment_notes,
              COUNT(DISTINCT tq.question_id) as question_count,
              COUNT(DISTINCT ta_attempts.id) as attempt_count
       FROM test_assignments ta
       INNER JOIN tests t ON ta.test_id = t.id
       LEFT JOIN test_questions tq ON t.id = tq.test_id
       LEFT JOIN test_attempts ta_attempts ON t.id = ta_attempts.test_id AND ta_attempts.candidate_id = ta.candidate_id
       WHERE ta.candidate_id = ? AND t.company_id = ? AND t.status = 'active'
       GROUP BY ta.id, t.id
       ORDER BY ta.assigned_at DESC`,
      [candidateId, companyId]
    );

    // Check attempt limits and due dates for each test
    const testsWithStatus = tests.map(test => {
      // Count ALL attempts (including in_progress) for remaining attempts calculation
      // This ensures that when a test is started, remaining attempts decreases by 1
      const totalAttempts = test.attempt_count || 0;
      const maxAttempts = test.max_attempts || 1;
      const remainingAttempts = Math.max(0, maxAttempts - totalAttempts);
      const canAttempt = totalAttempts < maxAttempts;
      const isExpired = test.due_date && new Date(test.due_date) < new Date();
      const canTake = canAttempt && !isExpired && test.assignment_status !== 'expired';
      
      return {
        ...test,
        can_attempt: canTake,
        remaining_attempts: remainingAttempts,
        is_expired: isExpired,
        assignment_id: test.assignment_id
      };
    });

    res.json({
      success: true,
      data: testsWithStatus
    });
  } catch (error) {
    logger.error('Get available tests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available tests',
      error: error.message
    });
  }
};

// Setup password using token (from invitation email)
const setupPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find candidate by token
    const [candidates] = await db.pool.execute(
      'SELECT * FROM candidates WHERE password_setup_token = ?',
      [token]
    );

    if (candidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const candidate = candidates[0];

    // Check if token is expired
    if (new Date() > new Date(candidate.password_setup_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Token has expired. Please request a new invitation.'
      });
    }

    // Check if password is already set
    if (candidate.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'Password is already set. Please login instead.'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update candidate with password and clear token
    await db.pool.execute(
      `UPDATE candidates 
       SET password_hash = ?, 
           password_setup_token = NULL, 
           password_setup_expires = NULL,
           status = 'active'
       WHERE id = ?`,
      [passwordHash, candidate.id]
    );

    logger.info(`Password set for candidate: ${candidate.email}`);

    res.json({
      success: true,
      message: 'Password set successfully. You can now login.'
    });
  } catch (error) {
    logger.error('Setup password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting password',
      error: error.message
    });
  }
};

// Verify setup token (for frontend to check if token is valid)
const verifySetupToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const [candidates] = await db.pool.execute(
      'SELECT id, email, first_name, last_name, password_setup_expires, password_hash FROM candidates WHERE password_setup_token = ?',
      [token]
    );

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const candidate = candidates[0];

    // Check if token is expired
    if (new Date() > new Date(candidate.password_setup_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Token has expired',
        expired: true
      });
    }

    // Check if password is already set
    if (candidate.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'Password is already set',
        password_set: true
      });
    }

    res.json({
      success: true,
      data: {
        email: candidate.email,
        name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate'
      }
    });
  } catch (error) {
    logger.error('Verify setup token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying token',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  setupPassword,
  verifySetupToken,
  getCurrentCandidate,
  getAvailableTests
};

