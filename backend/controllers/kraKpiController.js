const db = require('../config/database');
const logger = require('../utils/logger');
const kraKpiCalculator = require('../utils/kraKpiCalculator');

/**
 * Manually trigger KRA/KPI calculation for a test attempt
 * Useful for debugging and re-calculating
 */
const recalculateKRAKPI = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    if (!attempt_id) {
      return res.status(400).json({
        success: false,
        message: 'attempt_id is required'
      });
    }

    // Get attempt details
    const [attempts] = await db.pool.execute(
      `SELECT ta.*, t.company_id 
       FROM test_attempts ta
       JOIN tests t ON ta.test_id = t.id
       WHERE ta.id = ? AND t.company_id = ?`,
      [attempt_id, companyId]
    );

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found or access denied'
      });
    }

    const attempt = attempts[0];

    // Trigger calculation
    const result = await kraKpiCalculator.calculateAndStoreKRAKPIPerformance(
      attempt_id,
      attempt.test_id,
      attempt.candidate_id,
      companyId
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'KRA/KPI calculation completed successfully',
        data: result.summary
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'KRA/KPI calculation failed',
        details: result.details
      });
    }
  } catch (error) {
    logger.error('Recalculate KRA/KPI error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recalculating KRA/KPI',
      error: error.message
    });
  }
};

/**
 * Get KRA/KPI calculation status for an attempt
 */
const getCalculationStatus = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Get attempt
    const [attempts] = await db.pool.execute(
      `SELECT ta.*, t.company_id 
       FROM test_attempts ta
       JOIN tests t ON ta.test_id = t.id
       WHERE ta.id = ? AND t.company_id = ?`,
      [attempt_id, companyId]
    );

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    const attempt = attempts[0];

    // Check if scores exist
    const [scores] = await db.pool.execute(
      'SELECT category_scores FROM scores WHERE attempt_id = ?',
      [attempt_id]
    );

    // Check if KRAs are assigned
    const [assignedKRAs] = await db.pool.execute(
      `SELECT COUNT(*) as count FROM employee_kras 
       WHERE employee_type = 'candidate' AND employee_id = ? AND company_id = ? AND status = 'active'`,
      [attempt.candidate_id, companyId]
    );

    // Check if KPI performance exists
    const [kpiPerformance] = await db.pool.execute(
      `SELECT COUNT(*) as count FROM kpi_performance 
       WHERE employee_type = 'candidate' AND employee_id = ? AND company_id = ?`,
      [attempt.candidate_id, companyId]
    );

    // Check if KRA performance exists
    const [kraPerformance] = await db.pool.execute(
      `SELECT COUNT(*) as count FROM kra_performance_summary 
       WHERE employee_type = 'candidate' AND employee_id = ? AND company_id = ?`,
      [attempt.candidate_id, companyId]
    );

    res.json({
      success: true,
      data: {
        attempt_id,
        candidate_id: attempt.candidate_id,
        test_id: attempt.test_id,
        has_scores: scores.length > 0,
        has_category_scores: scores.length > 0 && scores[0].category_scores,
        kras_assigned: assignedKRAs[0].count,
        kpi_performance_records: kpiPerformance[0].count,
        kra_performance_records: kraPerformance[0].count,
        can_calculate: scores.length > 0 && assignedKRAs[0].count > 0
      }
    });
  } catch (error) {
    logger.error('Get calculation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting calculation status',
      error: error.message
    });
  }
};

module.exports = {
  recalculateKRAKPI,
  getCalculationStatus
};

