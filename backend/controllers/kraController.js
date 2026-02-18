const db = require('../config/database');
const logger = require('../utils/logger');

// Get all KRAs for a company
const getKRAs = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { status, category, search } = req.query;

    let query = `
      SELECT k.*, u.first_name as created_by_name, u.last_name as created_by_last_name,
             COUNT(DISTINCT kp.id) as kpi_count
      FROM kras k
      LEFT JOIN users u ON k.created_by = u.id
      LEFT JOIN kpis kp ON k.id = kp.kra_id
      WHERE k.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      query += ' AND k.status = ?';
      params.push(status);
    }

    if (req.query.role_name) {
      query += ' AND k.role_name = ?';
      params.push(req.query.role_name);
    }

    if (search) {
      query += ' AND (k.title LIKE ? OR k.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' GROUP BY k.id ORDER BY k.created_at DESC';

    const kras = await db.query(query, params);

    res.json({
      success: true,
      data: kras
    });
  } catch (error) {
    logger.error('Get KRAs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KRAs',
      error: error.message
    });
  }
};

// Get single KRA
const getKRA = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [kras] = await db.pool.execute(
      `SELECT k.*, u.first_name as created_by_name, u.last_name as created_by_last_name
       FROM kras k
       LEFT JOIN users u ON k.created_by = u.id
       WHERE k.id = ? AND k.company_id = ?`,
      [id, companyId]
    );

    if (kras.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KRA not found'
      });
    }

    // Get KPIs for this KRA
    const kpis = await db.query(
      `SELECT * FROM kpis WHERE kra_id = ? AND company_id = ? ORDER BY created_at ASC`,
      [id, companyId]
    );

    res.json({
      success: true,
      data: {
        ...kras[0],
        kpis
      }
    });
  } catch (error) {
    logger.error('Get KRA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KRA',
      error: error.message
    });
  }
};

// Create KRA
const createKRA = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const {
      role_name,
      title,
      description,
      weight,
      evaluation_period,
      status
    } = req.body;

    // Validation
    if (!role_name || !role_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0 || weightValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be a number between 0 and 100'
      });
    }

    // Validate total weight for role = 100%
    const [existingKRAs] = await db.pool.execute(
      `SELECT SUM(weight) as total_weight FROM kras 
       WHERE company_id = ? AND role_name = ? AND status = 'active'`,
      [companyId, role_name.trim()]
    );

    const currentTotal = parseFloat(existingKRAs[0]?.total_weight || 0);
    const newTotal = currentTotal + weightValue;

    if (newTotal > 100) {
      return res.status(400).json({
        success: false,
        message: `Total weight for role "${role_name}" would exceed 100%. Current total: ${currentTotal.toFixed(2)}%, Adding: ${weightValue.toFixed(2)}%, New total: ${newTotal.toFixed(2)}%`
      });
    }

    const [result] = await db.pool.execute(
      `INSERT INTO kras (company_id, role_name, title, description, weight, evaluation_period, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        role_name.trim(),
        title.trim(),
        description || null,
        weightValue,
        evaluation_period || 'quarterly',
        status || 'active',
        req.user.id
      ]
    );

    logger.info(`KRA created: ${result.insertId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'KRA created successfully',
      data: { kra_id: result.insertId }
    });
  } catch (error) {
    logger.error('Create KRA error:', error);
    console.error('Full error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      stack: error.stack
    });
    
    // Check if it's a column error (likely missing role_name or evaluation_period)
    if (error.code === 'ER_BAD_FIELD_ERROR' || error.sqlMessage?.includes('Unknown column')) {
      return res.status(500).json({
        success: false,
        message: 'Database schema mismatch. Please run the migration: migration_update_kra_add_role_and_evaluation.sql',
        error: error.sqlMessage || error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating KRA',
      error: error.sqlMessage || error.message
    });
  }
};

// Update KRA
const updateKRA = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;
    const updateData = req.body;

    // Verify KRA exists and belongs to company
    const [kras] = await db.pool.execute(
      'SELECT id, role_name, weight FROM kras WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (kras.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KRA not found'
      });
    }

    const existingKRA = kras[0];
    const roleName = updateData.role_name?.trim() || existingKRA.role_name;
    const newWeight = updateData.weight !== undefined ? parseFloat(updateData.weight) : existingKRA.weight;

    // Validate weight if being updated
    if (updateData.weight !== undefined) {
      if (isNaN(newWeight) || newWeight <= 0 || newWeight > 100) {
        return res.status(400).json({
          success: false,
          message: 'Weight must be a number between 0 and 100'
        });
      }

      // Validate total weight for role = 100%
      const [existingKRAs] = await db.pool.execute(
        `SELECT SUM(weight) as total_weight FROM kras 
         WHERE company_id = ? AND role_name = ? AND status = 'active' AND id != ?`,
        [companyId, roleName, id]
      );

      const currentTotal = parseFloat(existingKRAs[0]?.total_weight || 0);
      const newTotal = currentTotal + newWeight;

      if (newTotal > 100) {
        return res.status(400).json({
          success: false,
          message: `Total weight for role "${roleName}" would exceed 100%. Current total: ${currentTotal.toFixed(2)}%, Adding: ${newWeight.toFixed(2)}%, New total: ${newTotal.toFixed(2)}%`
        });
      }
    }

    // Build update query
    const allowedFields = ['role_name', 'title', 'description', 'weight', 'evaluation_period', 'status'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'role_name') {
          updates.push(`${field} = ?`);
          values.push(updateData[field].trim());
        } else if (field === 'weight') {
          updates.push(`${field} = ?`);
          values.push(newWeight);
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
      `UPDATE kras SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
      values
    );

    logger.info(`KRA updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'KRA updated successfully'
    });
  } catch (error) {
    logger.error('Update KRA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating KRA',
      error: error.message
    });
  }
};

// Delete KRA
const deleteKRA = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [kras] = await db.pool.execute(
      'SELECT id FROM kras WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (kras.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KRA not found'
      });
    }

    await db.query(
      'DELETE FROM kras WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    logger.info(`KRA deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'KRA deleted successfully'
    });
  } catch (error) {
    logger.error('Delete KRA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting KRA',
      error: error.message
    });
  }
};

// Assign KRA to employee/candidate
const assignKRA = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const {
      employee_type,
      employee_id,
      kra_id,
      start_date,
      end_date,
      weight,
      notes
    } = req.body;

    if (!employee_type || !employee_id || !kra_id) {
      return res.status(400).json({
        success: false,
        message: 'employee_type, employee_id, and kra_id are required'
      });
    }

    // Verify KRA exists
    const [kras] = await db.pool.execute(
      'SELECT id FROM kras WHERE id = ? AND company_id = ?',
      [kra_id, companyId]
    );

    if (kras.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KRA not found'
      });
    }

    // Verify employee exists
    if (employee_type === 'user') {
      const [users] = await db.pool.execute(
        'SELECT id FROM users WHERE id = ? AND company_id = ?',
        [employee_id, companyId]
      );
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
    } else if (employee_type === 'candidate') {
      const [candidates] = await db.pool.execute(
        'SELECT id FROM candidates WHERE id = ? AND company_id = ?',
        [employee_id, companyId]
      );
      if (candidates.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Candidate not found'
        });
      }
    }

    // Check if already assigned
    const [existing] = await db.pool.execute(
      `SELECT id FROM employee_kras 
       WHERE employee_type = ? AND employee_id = ? AND kra_id = ? AND status = 'active'`,
      [employee_type, employee_id, kra_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'KRA already assigned to this employee'
      });
    }

    const [result] = await db.pool.execute(
      `INSERT INTO employee_kras 
       (company_id, employee_type, employee_id, kra_id, assigned_by, start_date, end_date, weight, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        employee_type,
        employee_id,
        kra_id,
        req.user.id,
        start_date || null,
        end_date || null,
        weight || 1.0,
        notes || null
      ]
    );

    logger.info(`KRA assigned: ${kra_id} to ${employee_type} ${employee_id} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'KRA assigned successfully',
      data: { assignment_id: result.insertId }
    });
  } catch (error) {
    logger.error('Assign KRA error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning KRA',
      error: error.message
    });
  }
};

// Get employee KRAs
const getEmployeeKRAs = async (req, res) => {
  try {
    const { employee_type, employee_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const kras = await db.query(
      `SELECT ek.*, k.title, k.description, k.category, k.weight as kra_weight,
              u.first_name as assigned_by_name, u.last_name as assigned_by_last_name
       FROM employee_kras ek
       JOIN kras k ON ek.kra_id = k.id
       LEFT JOIN users u ON ek.assigned_by = u.id
       WHERE ek.employee_type = ? AND ek.employee_id = ? AND ek.company_id = ? AND ek.status = 'active'
       ORDER BY ek.assigned_at DESC`,
      [employee_type, employee_id, companyId]
    );

    res.json({
      success: true,
      data: kras
    });
  } catch (error) {
    logger.error('Get employee KRAs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee KRAs',
      error: error.message
    });
  }
};

module.exports = {
  getKRAs,
  getKRA,
  createKRA,
  updateKRA,
  deleteKRA,
  assignKRA,
  getEmployeeKRAs
};

