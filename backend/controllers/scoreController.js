const db = require('../config/database');
const logger = require('../utils/logger');

// Get scores for a test
const getTestScores = async (req, res) => {
  try {
    const { test_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Verify test belongs to company
    const [tests] = await db.pool.execute(
      'SELECT id FROM tests WHERE id = ? AND company_id = ?',
      [test_id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const scores = await db.query(
      `SELECT s.*, c.first_name, c.last_name, c.email, ta.started_at, ta.submitted_at
       FROM scores s
       JOIN candidates c ON s.candidate_id = c.id
       JOIN test_attempts ta ON s.attempt_id = ta.id
       WHERE s.test_id = ?
       ORDER BY s.percentage_score DESC`,
      [test_id]
    );

    // Parse JSON fields
    const parsedScores = scores.map(s => ({
      ...s,
      category_scores: typeof s.category_scores === 'string' 
        ? JSON.parse(s.category_scores) 
        : s.category_scores
    }));

    res.json({
      success: true,
      data: parsedScores
    });
  } catch (error) {
    logger.error('Get test scores error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching scores',
      error: error.message
    });
  }
};

// Get candidate scores
const getCandidateScores = async (req, res) => {
  try {
    const { candidate_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const scores = await db.query(
      `SELECT s.*, t.title as test_title, ta.started_at, ta.submitted_at
       FROM scores s
       JOIN tests t ON s.test_id = t.id
       JOIN test_attempts ta ON s.attempt_id = ta.id
       WHERE s.candidate_id = ? AND t.company_id = ?
       ORDER BY s.calculated_at DESC`,
      [candidate_id, companyId]
    );

    // Parse JSON fields
    const parsedScores = scores.map(s => ({
      ...s,
      category_scores: typeof s.category_scores === 'string' 
        ? JSON.parse(s.category_scores) 
        : s.category_scores
    }));

    res.json({
      success: true,
      data: parsedScores
    });
  } catch (error) {
    logger.error('Get candidate scores error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate scores',
      error: error.message
    });
  }
};

// Get score statistics
const getScoreStatistics = async (req, res) => {
  try {
    const { test_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Verify test belongs to company
    const [tests] = await db.pool.execute(
      'SELECT id FROM tests WHERE id = ? AND company_id = ?',
      [test_id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Get statistics
    const [stats] = await db.pool.execute(
      `SELECT 
        COUNT(*) as total_attempts,
        AVG(percentage_score) as average_score,
        MIN(percentage_score) as min_score,
        MAX(percentage_score) as max_score,
        STDDEV(percentage_score) as std_deviation,
        AVG(percentile) as average_percentile,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed_count
       FROM scores
       WHERE test_id = ?`,
      [test_id]
    );

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    logger.error('Get score statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

module.exports = {
  getTestScores,
  getCandidateScores,
  getScoreStatistics
};

