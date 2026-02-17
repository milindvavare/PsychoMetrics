const db = require('../config/database');
const logger = require('../utils/logger');

// Generate shortlist recommendation
const generateShortlist = async (req, res) => {
  try {
    const { test_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Verify test belongs to company
    const [tests] = await db.pool.execute(
      'SELECT * FROM tests WHERE id = ? AND company_id = ?',
      [test_id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const test = tests[0];

    if (!test.enable_shortlist) {
      return res.status(400).json({
        success: false,
        message: 'Shortlist recommendation is not enabled for this test'
      });
    }

    // Get all scores for this test
    const scores = await db.query(
      `SELECT s.*, c.first_name, c.last_name, c.email, c.id as candidate_id
       FROM scores s
       JOIN candidates c ON s.candidate_id = c.id
       WHERE s.test_id = ?
       ORDER BY s.percentage_score DESC`,
      [test_id]
    );

    // Calculate recommendation scores
    const recommendations = [];

    for (const score of scores) {
      const categoryScores = typeof score.category_scores === 'string' 
        ? JSON.parse(score.category_scores) 
        : score.category_scores;

      // Calculate recommendation score based on multiple factors
      let recommendationScore = score.percentage_score;

      // Factor 1: Overall score (40% weight)
      const overallScoreFactor = score.percentage_score * 0.4;

      // Factor 2: Percentile (30% weight)
      const percentileFactor = (score.percentile || 50) * 0.3;

      // Factor 3: Consistency across categories (20% weight)
      const categoryPercentages = Object.values(categoryScores).map(c => c.percentage);
      const avgCategoryScore = categoryPercentages.reduce((a, b) => a + b, 0) / categoryPercentages.length;
      const variance = categoryPercentages.reduce((sum, val) => sum + Math.pow(val - avgCategoryScore, 2), 0) / categoryPercentages.length;
      const consistencyFactor = (100 - Math.min(variance, 100)) * 0.2;

      // Factor 4: Passing status (10% weight)
      const passingFactor = score.passed ? 10 : 0;

      recommendationScore = overallScoreFactor + percentileFactor + consistencyFactor + passingFactor;

      // Determine recommendation status
      let recommendationStatus = 'maybe';
      if (recommendationScore >= 80) {
        recommendationStatus = 'recommended';
      } else if (recommendationScore < 50) {
        recommendationStatus = 'not_recommended';
      }

      // Generate reasoning
      const reasoning = generateReasoning(score, categoryScores, recommendationScore);

      // Save or update recommendation
      const [existing] = await db.pool.execute(
        'SELECT id FROM shortlist_recommendations WHERE test_id = ? AND candidate_id = ?',
        [test_id, score.candidate_id]
      );

      if (existing.length > 0) {
        await db.query(
          `UPDATE shortlist_recommendations 
           SET recommendation_score = ?, recommendation_status = ?, reasoning = ?, factors = ?
           WHERE test_id = ? AND candidate_id = ?`,
          [
            recommendationScore,
            recommendationStatus,
            reasoning,
            JSON.stringify({
              overall_score: overallScoreFactor,
              percentile: percentileFactor,
              consistency: consistencyFactor,
              passing: passingFactor
            }),
            test_id,
            score.candidate_id
          ]
        );
      } else {
        await db.query(
          `INSERT INTO shortlist_recommendations 
           (company_id, test_id, candidate_id, recommendation_score, recommendation_status, reasoning, factors)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            test_id,
            score.candidate_id,
            recommendationScore,
            recommendationStatus,
            reasoning,
            JSON.stringify({
              overall_score: overallScoreFactor,
              percentile: percentileFactor,
              consistency: consistencyFactor,
              passing: passingFactor
            })
          ]
        );
      }

      recommendations.push({
        candidate_id: score.candidate_id,
        candidate_name: `${score.first_name} ${score.last_name}`,
        candidate_email: score.email,
        recommendation_score: parseFloat(recommendationScore.toFixed(2)),
        recommendation_status: recommendationStatus,
        reasoning,
        test_score: score.percentage_score,
        percentile: score.percentile
      });
    }

    // Sort by recommendation score
    recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score);

    logger.info(`Shortlist recommendations generated for test ${test_id}`);

    res.json({
      success: true,
      data: {
        test_id,
        recommendations,
        summary: {
          total_candidates: recommendations.length,
          recommended: recommendations.filter(r => r.recommendation_status === 'recommended').length,
          maybe: recommendations.filter(r => r.recommendation_status === 'maybe').length,
          not_recommended: recommendations.filter(r => r.recommendation_status === 'not_recommended').length
        }
      }
    });
  } catch (error) {
    logger.error('Generate shortlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating shortlist recommendations',
      error: error.message
    });
  }
};

// Generate reasoning text
const generateReasoning = (score, categoryScores, recommendationScore) => {
  let reasoning = '';

  if (recommendationScore >= 80) {
    reasoning = 'Strong candidate with excellent overall performance. ';
  } else if (recommendationScore >= 60) {
    reasoning = 'Good candidate with solid performance. ';
  } else {
    reasoning = 'Candidate may need further evaluation. ';
  }

  if (score.percentile && score.percentile >= 75) {
    reasoning += `Performs in the top ${100 - score.percentile}% of test takers. `;
  }

  if (score.passed) {
    reasoning += 'Meets the passing criteria. ';
  }

  // Check for strong/weak categories
  const strongCategories = Object.values(categoryScores)
    .filter(c => c.percentage >= 80)
    .map(c => c.category_name);

  const weakCategories = Object.values(categoryScores)
    .filter(c => c.percentage < 50)
    .map(c => c.category_name);

  if (strongCategories.length > 0) {
    reasoning += `Strong in: ${strongCategories.join(', ')}. `;
  }

  if (weakCategories.length > 0) {
    reasoning += `Areas for improvement: ${weakCategories.join(', ')}.`;
  }

  return reasoning.trim();
};

// Get shortlist recommendations
const getShortlist = async (req, res) => {
  try {
    const { test_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const recommendations = await db.query(
      `SELECT sr.*, c.first_name, c.last_name, c.email
       FROM shortlist_recommendations sr
       JOIN candidates c ON sr.candidate_id = c.id
       WHERE sr.test_id = ? AND sr.company_id = ?
       ORDER BY sr.recommendation_score DESC`,
      [test_id, companyId]
    );

    // Parse JSON fields
    const parsedRecommendations = recommendations.map(r => ({
      ...r,
      factors: typeof r.factors === 'string' ? JSON.parse(r.factors) : r.factors
    }));

    res.json({
      success: true,
      data: parsedRecommendations
    });
  } catch (error) {
    logger.error('Get shortlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shortlist recommendations',
      error: error.message
    });
  }
};

module.exports = {
  generateShortlist,
  getShortlist
};

