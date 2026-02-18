const db = require('../config/database');
const logger = require('../utils/logger');

// Get all KPIs for a company
const getKPIs = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { kra_id, status, search } = req.query;

    let query = `
      SELECT kp.*, k.title as kra_title, u.first_name as created_by_name, u.last_name as created_by_last_name
      FROM kpis kp
      LEFT JOIN kras k ON kp.kra_id = k.id
      LEFT JOIN users u ON kp.created_by = u.id
      WHERE kp.company_id = ?
    `;
    const params = [companyId];

    if (kra_id) {
      query += ' AND kp.kra_id = ?';
      params.push(kra_id);
    }

    if (status) {
      query += ' AND kp.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (kp.title LIKE ? OR kp.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY kp.created_at DESC';

    const kpis = await db.query(query, params);

    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    logger.error('Get KPIs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KPIs',
      error: error.message
    });
  }
};

// Get single KPI
const getKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [kpis] = await db.pool.execute(
      `SELECT kp.*, k.title as kra_title,
              tc.id as test_category_id, tc.name as test_category_name,
              u.first_name as created_by_name, u.last_name as created_by_last_name
       FROM kpis kp
       LEFT JOIN kras k ON kp.kra_id = k.id
       LEFT JOIN test_categories tc ON kp.test_category_id = tc.id
       LEFT JOIN users u ON kp.created_by = u.id
       WHERE kp.id = ? AND kp.company_id = ?`,
      [id, companyId]
    );

    if (kpis.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KPI not found'
      });
    }

    res.json({
      success: true,
      data: kpis[0]
    });
  } catch (error) {
    logger.error('Get KPI error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KPI',
      error: error.message
    });
  }
};

// Create KPI
const createKPI = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const {
      kra_id,
      title,
      description,
      measurement_type,
      target_value,
      unit,
      frequency,
      weight,
      formula,
      status,
      test_category_id
    } = req.body;

    if (!kra_id || !title) {
      return res.status(400).json({
        success: false,
        message: 'kra_id and title are required'
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

    // Verify test category exists if provided
    if (test_category_id) {
      const [categories] = await db.pool.execute(
        'SELECT id FROM test_categories WHERE id = ? AND company_id = ?',
        [test_category_id, companyId]
      );

      if (categories.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Test category not found'
        });
      }
    }

    const [result] = await db.pool.execute(
      `INSERT INTO kpis 
       (company_id, kra_id, test_category_id, title, description, measurement_type, target_value, unit, frequency, weight, formula, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        kra_id,
        test_category_id || null,
        title,
        description || null,
        measurement_type || 'percentage',
        target_value || null,
        unit || null,
        frequency || 'monthly',
        weight || 1.0,
        formula || null,
        status || 'active',
        req.user.id
      ]
    );

    logger.info(`KPI created: ${result.insertId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'KPI created successfully',
      data: { kpi_id: result.insertId }
    });
  } catch (error) {
    logger.error('Create KPI error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating KPI',
      error: error.message
    });
  }
};

// Update KPI
const updateKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;
    const updateData = req.body;

    // Verify KPI exists and belongs to company
    const [kpis] = await db.pool.execute(
      'SELECT id FROM kpis WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (kpis.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KPI not found'
      });
    }

    // Verify test category exists if provided
    if (updateData.test_category_id) {
      const [categories] = await db.pool.execute(
        'SELECT id FROM test_categories WHERE id = ? AND company_id = ?',
        [updateData.test_category_id, companyId]
      );

      if (categories.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Test category not found'
        });
      }
    }

    // Build update query
    const allowedFields = [
      'kra_id', 'test_category_id', 'title', 'description', 'measurement_type', 'target_value',
      'unit', 'frequency', 'weight', 'formula', 'status'
    ];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(updateData[field]);
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
      `UPDATE kpis SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
      values
    );

    logger.info(`KPI updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'KPI updated successfully'
    });
  } catch (error) {
    logger.error('Update KPI error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating KPI',
      error: error.message
    });
  }
};

// Delete KPI
const deleteKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [kpis] = await db.pool.execute(
      'SELECT id FROM kpis WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (kpis.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KPI not found'
      });
    }

    await db.query(
      'DELETE FROM kpis WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    logger.info(`KPI deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'KPI deleted successfully'
    });
  } catch (error) {
    logger.error('Delete KPI error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting KPI',
      error: error.message
    });
  }
};

// Submit KPI Performance
const submitKPIPerformance = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const {
      employee_type,
      employee_id,
      kpi_id,
      kra_id,
      period_start,
      period_end,
      actual_value,
      comments,
      evidence_url
    } = req.body;

    if (!employee_type || !employee_id || !kpi_id || !kra_id || !period_start || !period_end || actual_value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Get KPI details
    const [kpis] = await db.pool.execute(
      'SELECT * FROM kpis WHERE id = ? AND company_id = ?',
      [kpi_id, companyId]
    );

    if (kpis.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'KPI not found'
      });
    }

    const kpi = kpis[0];
    const targetValue = kpi.target_value || 0;

    // Calculate achievement percentage
    let achievementPercentage = 0;
    if (targetValue > 0) {
      achievementPercentage = (actual_value / targetValue) * 100;
    }

    // Determine rating
    let rating = null;
    if (achievementPercentage >= 100) rating = 'excellent';
    else if (achievementPercentage >= 90) rating = 'good';
    else if (achievementPercentage >= 75) rating = 'satisfactory';
    else if (achievementPercentage >= 60) rating = 'needs_improvement';
    else rating = 'poor';

    // Check if performance already exists
    const [existing] = await db.pool.execute(
      `SELECT id FROM kpi_performance 
       WHERE employee_type = ? AND employee_id = ? AND kpi_id = ? AND period_start = ? AND period_end = ?`,
      [employee_type, employee_id, kpi_id, period_start, period_end]
    );

    if (existing.length > 0) {
      // Update existing
      await db.query(
        `UPDATE kpi_performance SET
         actual_value = ?, achievement_percentage = ?, rating = ?, comments = ?, evidence_url = ?,
         status = 'submitted', submitted_by = ?, submitted_at = NOW()
         WHERE id = ?`,
        [actual_value, achievementPercentage, rating, comments || null, evidence_url || null, req.user.id, existing[0].id]
      );

      res.json({
        success: true,
        message: 'KPI performance updated successfully',
        data: { performance_id: existing[0].id }
      });
    } else {
      // Create new
      const [result] = await db.pool.execute(
        `INSERT INTO kpi_performance 
         (company_id, employee_type, employee_id, kpi_id, kra_id, period_start, period_end,
          target_value, actual_value, achievement_percentage, rating, comments, evidence_url,
          status, submitted_by, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, NOW())`,
        [
          companyId,
          employee_type,
          employee_id,
          kpi_id,
          kra_id,
          period_start,
          period_end,
          targetValue,
          actual_value,
          achievementPercentage,
          rating,
          comments || null,
          evidence_url || null,
          req.user.id
        ]
      );

      res.status(201).json({
        success: true,
        message: 'KPI performance submitted successfully',
        data: { performance_id: result.insertId }
      });
    }
  } catch (error) {
    logger.error('Submit KPI performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting KPI performance',
      error: error.message
    });
  }
};

// Get KPI Performance
const getKPIPerformance = async (req, res) => {
  try {
    const { employee_type, employee_id } = req.params;
    const { kpi_id, period_start, period_end } = req.query;
    const companyId = req.companyId || req.user.company_id;

    let query = `
      SELECT kp.*, k.title as kpi_title, k.measurement_type, k.unit, k.target_value as kpi_target,
             kr.title as kra_title
      FROM kpi_performance kp
      JOIN kpis k ON kp.kpi_id = k.id
      JOIN kras kr ON kp.kra_id = kr.id
      WHERE kp.employee_type = ? AND kp.employee_id = ? AND kp.company_id = ?
    `;
    const params = [employee_type, employee_id, companyId];

    if (kpi_id) {
      query += ' AND kp.kpi_id = ?';
      params.push(kpi_id);
    }

    if (period_start) {
      query += ' AND kp.period_start >= ?';
      params.push(period_start);
    }

    if (period_end) {
      query += ' AND kp.period_end <= ?';
      params.push(period_end);
    }

    query += ' ORDER BY kp.period_start DESC, kp.created_at DESC';

    const performance = await db.query(query, params);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('Get KPI performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KPI performance',
      error: error.message
    });
  }
};

// Approve/Reject KPI Performance
const reviewKPIPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_comments } = req.body;
    const companyId = req.companyId || req.user.company_id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved or rejected'
      });
    }

    const [performance] = await db.pool.execute(
      'SELECT * FROM kpi_performance WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (performance.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Performance record not found'
      });
    }

    await db.query(
      `UPDATE kpi_performance SET
       status = ?, approved_by = ?, approved_at = NOW(), comments = ?
       WHERE id = ?`,
      [status, req.user.id, review_comments || null, id]
    );

    logger.info(`KPI performance ${status}: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: `KPI performance ${status} successfully`
    });
  } catch (error) {
    logger.error('Review KPI performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reviewing KPI performance',
      error: error.message
    });
  }
};

module.exports = {
  getKPIs,
  getKPI,
  createKPI,
  updateKPI,
  deleteKPI,
  submitKPIPerformance,
  getKPIPerformance,
  reviewKPIPerformance
};

