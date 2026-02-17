const db = require('../config/database');
const logger = require('../utils/logger');
const { sendCandidateInvitation } = require('../utils/emailService');
const crypto = require('crypto');

// Create candidate
const createCandidate = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { email, first_name, last_name, phone, resume_url, metadata, send_invitation } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if candidate already exists
    const [existing] = await db.pool.execute(
      'SELECT id FROM candidates WHERE email = ? AND company_id = ?',
      [email, companyId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Candidate with this email already exists for this company'
      });
    }

    // Generate password setup token
    const passwordSetupToken = crypto.randomBytes(32).toString('hex');
    const passwordSetupExpires = new Date();
    passwordSetupExpires.setDate(passwordSetupExpires.getDate() + 7); // 7 days from now

    const [result] = await db.pool.execute(
      `INSERT INTO candidates (company_id, email, first_name, last_name, phone, resume_url, metadata, password_setup_token, password_setup_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        email,
        first_name || null,
        last_name || null,
        phone || null,
        resume_url || null,
        metadata ? JSON.stringify(metadata) : null,
        passwordSetupToken,
        passwordSetupExpires
      ]
    );

    logger.info(`Candidate created: ${result.insertId} - ${email}`);

    // Get company name for email
    const [companies] = await db.pool.execute(
      'SELECT name FROM companies WHERE id = ?',
      [companyId]
    );
    const companyName = companies.length > 0 ? companies[0].name : null;

    // Send invitation email if requested (default: true)
    let emailSent = false;
    let emailError = null;
    
    if (send_invitation !== false) {
      try {
        await sendCandidateInvitation(
          email,
          first_name || last_name ? `${first_name || ''} ${last_name || ''}`.trim() : null,
          passwordSetupToken,
          companyName
        );
        emailSent = true;
        logger.info(`Invitation email sent to candidate: ${email}`);
      } catch (err) {
        emailError = err.message || 'Unknown error';
        logger.error('Failed to send invitation email:', err);
        // Log full error details
        logger.error('Email error details:', {
          message: err.message,
          stack: err.stack,
          code: err.code
        });
      }
    }

    const message = emailSent 
      ? 'Candidate created successfully and invitation email sent'
      : send_invitation !== false && emailError
      ? `Candidate created successfully, but email could not be sent: ${emailError}`
      : 'Candidate created successfully';

    res.status(201).json({
      success: true,
      message: message,
      data: { 
        candidate_id: result.insertId,
        invitation_sent: emailSent,
        email_error: emailError || null
      }
    });
  } catch (error) {
    logger.error('Create candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating candidate',
      error: error.message
    });
  }
};

// Get candidates
const getCandidates = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { search } = req.query;

    let query = 'SELECT * FROM candidates WHERE company_id = ?';
    const params = [companyId];

    if (search) {
      query += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    const candidates = await db.query(query, params);

    // Parse JSON fields
    const parsedCandidates = candidates.map(c => ({
      ...c,
      metadata: c.metadata ? (typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata) : null
    }));

    res.json({
      success: true,
      data: parsedCandidates
    });
  } catch (error) {
    logger.error('Get candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidates',
      error: error.message
    });
  }
};

// Get single candidate
const getCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [candidates] = await db.pool.execute(
      'SELECT * FROM candidates WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const candidate = candidates[0];
    candidate.metadata = candidate.metadata 
      ? (typeof candidate.metadata === 'string' ? JSON.parse(candidate.metadata) : candidate.metadata)
      : null;

    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    logger.error('Get candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate',
      error: error.message
    });
  }
};

// Update candidate
const updateCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;
    const updateData = req.body;

    // Verify candidate exists
    const [candidates] = await db.pool.execute(
      'SELECT id FROM candidates WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Build update query
    const allowedFields = ['email', 'first_name', 'last_name', 'phone', 'resume_url', 'metadata'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'metadata' && typeof updateData[field] === 'object') {
          updates.push(`${field} = ?`);
          values.push(JSON.stringify(updateData[field]));
        } else {
          updates.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id, companyId);

    await db.query(
      `UPDATE candidates SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
      values
    );

    logger.info(`Candidate updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Candidate updated successfully'
    });
  } catch (error) {
    logger.error('Update candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating candidate',
      error: error.message
    });
  }
};

// Delete candidate
const deleteCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Verify candidate exists
    const [candidates] = await db.pool.execute(
      'SELECT id, email FROM candidates WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Delete candidate (cascade will handle related records)
    await db.pool.execute(
      'DELETE FROM candidates WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    logger.info(`Candidate deleted: ${id} - ${candidates[0].email} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  } catch (error) {
    logger.error('Delete candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting candidate',
      error: error.message
    });
  }
};

module.exports = {
  createCandidate,
  getCandidates,
  getCandidate,
  updateCandidate,
  deleteCandidate
};

