const db = require('../config/database');
const logger = require('../utils/logger');

// Get radar chart data for a candidate
const getRadarData = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Get attempt and verify access
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

    // Get score with category scores
    const [scores] = await db.pool.execute(
      'SELECT * FROM scores WHERE attempt_id = ?',
      [attempt_id]
    );

    if (scores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Score not found for this attempt'
      });
    }

    const score = scores[0];
    const categoryScores = typeof score.category_scores === 'string' 
      ? JSON.parse(score.category_scores) 
      : score.category_scores;

    // Format for radar chart
    const radarData = {
      labels: [],
      datasets: [
        {
          label: 'Score',
          data: [],
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          pointBackgroundColor: 'rgba(54, 162, 235, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
        }
      ]
    };

    // Populate radar data from category scores
    for (const categoryId in categoryScores) {
      const category = categoryScores[categoryId];
      radarData.labels.push(category.category_name);
      radarData.datasets[0].data.push(category.percentage);
    }

    res.json({
      success: true,
      data: radarData
    });
  } catch (error) {
    logger.error('Get radar data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating radar chart data',
      error: error.message
    });
  }
};

// Get comparative radar data (multiple candidates)
const getComparativeRadarData = async (req, res) => {
  try {
    const { test_id } = req.params;
    const { candidate_ids } = req.query;
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

    // Get category structure
    const categories = await db.query(
      `SELECT tc.id, tc.name
       FROM test_categories_mapping tcm
       JOIN test_categories tc ON tcm.category_id = tc.id
       WHERE tcm.test_id = ?
       ORDER BY tc.name`,
      [test_id]
    );

    const labels = categories.map(c => c.name);

    // Get scores for specified candidates or all candidates
    let query = `
      SELECT s.*, c.first_name, c.last_name, c.email
      FROM scores s
      JOIN candidates c ON s.candidate_id = c.id
      WHERE s.test_id = ?
    `;
    const params = [test_id];

    if (candidate_ids) {
      const ids = candidate_ids.split(',').map(id => parseInt(id));
      query += ' AND s.candidate_id IN (' + ids.map(() => '?').join(',') + ')';
      params.push(...ids);
    }

    const scores = await db.query(query, params);

    // Format datasets
    const datasets = scores.map((score, index) => {
      const categoryScores = typeof score.category_scores === 'string' 
        ? JSON.parse(score.category_scores) 
        : score.category_scores;

      const data = categories.map(cat => {
        const catScore = categoryScores[cat.id];
        return catScore ? catScore.percentage : 0;
      });

      const colors = [
        { bg: 'rgba(54, 162, 235, 0.2)', border: 'rgba(54, 162, 235, 1)' },
        { bg: 'rgba(255, 99, 132, 0.2)', border: 'rgba(255, 99, 132, 1)' },
        { bg: 'rgba(75, 192, 192, 0.2)', border: 'rgba(75, 192, 192, 1)' },
        { bg: 'rgba(255, 206, 86, 0.2)', border: 'rgba(255, 206, 86, 1)' },
        { bg: 'rgba(153, 102, 255, 0.2)', border: 'rgba(153, 102, 255, 1)' }
      ];

      const color = colors[index % colors.length];

      return {
        label: `${score.first_name} ${score.last_name}`,
        data: data,
        backgroundColor: color.bg,
        borderColor: color.border,
        pointBackgroundColor: color.border,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: color.border
      };
    });

    res.json({
      success: true,
      data: {
        labels,
        datasets
      }
    });
  } catch (error) {
    logger.error('Get comparative radar data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating comparative radar chart data',
      error: error.message
    });
  }
};

module.exports = {
  getRadarData,
  getComparativeRadarData
};

