const db = require('../config/database');
const logger = require('../utils/logger');
const axios = require('axios');

// Generate AI interpretation
const generateInterpretation = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Get attempt and verify access
    const [attempts] = await db.pool.execute(
      `SELECT ta.*, t.company_id, t.enable_ai_interpretation
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

    if (!attempt.enable_ai_interpretation) {
      return res.status(400).json({
        success: false,
        message: 'AI interpretation is not enabled for this test'
      });
    }

    // Check if interpretation already exists
    const [existing] = await db.pool.execute(
      'SELECT * FROM ai_interpretations WHERE attempt_id = ?',
      [attempt_id]
    );

    if (existing.length > 0) {
      return res.json({
        success: true,
        data: existing[0]
      });
    }

    // Get score and category scores
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

    // Get test details
    const [tests] = await db.pool.execute(
      'SELECT title, description FROM tests WHERE id = ?',
      [attempt.test_id]
    );

    // Generate interpretation using AI service or fallback to rule-based
    let interpretation;
    
    if (process.env.AI_SERVICE_URL && process.env.AI_API_KEY) {
      // Call external AI service
      try {
        const aiResponse = await axios.post(
          process.env.AI_SERVICE_URL,
          {
            test_title: tests[0].title,
            test_description: tests[0].description,
            total_score: score.percentage_score,
            percentile: score.percentile,
            category_scores: categoryScores
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.AI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        interpretation = aiResponse.data;
      } catch (aiError) {
        logger.warn('AI service error, using fallback:', aiError.message);
        interpretation = generateRuleBasedInterpretation(score, categoryScores, tests[0]);
      }
    } else {
      // Use rule-based interpretation
      interpretation = generateRuleBasedInterpretation(score, categoryScores, tests[0]);
    }

    // Save interpretation
    const [result] = await db.pool.execute(
      `INSERT INTO ai_interpretations 
       (attempt_id, interpretation_text, strengths, weaknesses, recommendations, confidence_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        attempt_id,
        interpretation.interpretation_text,
        JSON.stringify(interpretation.strengths || []),
        JSON.stringify(interpretation.weaknesses || []),
        JSON.stringify(interpretation.recommendations || []),
        interpretation.confidence_score || 0.85
      ]
    );

    logger.info(`AI interpretation generated: ${result.insertId} for attempt ${attempt_id}`);

    res.json({
      success: true,
      data: {
        id: result.insertId,
        ...interpretation
      }
    });
  } catch (error) {
    logger.error('Generate interpretation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AI interpretation',
      error: error.message
    });
  }
};

// Rule-based interpretation fallback
const generateRuleBasedInterpretation = (score, categoryScores, test) => {
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  // Analyze category scores
  for (const categoryId in categoryScores) {
    const category = categoryScores[categoryId];
    
    if (category.percentage >= 80) {
      strengths.push({
        category: category.category_name,
        score: category.percentage,
        message: `Strong performance in ${category.category_name}`
      });
    } else if (category.percentage < 50) {
      weaknesses.push({
        category: category.category_name,
        score: category.percentage,
        message: `Needs improvement in ${category.category_name}`
      });
      recommendations.push({
        category: category.category_name,
        suggestion: `Focus on developing skills in ${category.category_name}`
      });
    }
  }

  // Overall interpretation
  let interpretationText = `Based on the test results, `;
  
  if (score.percentage_score >= 90) {
    interpretationText += `the candidate demonstrated exceptional performance with a score of ${score.percentage_score}%. `;
  } else if (score.percentage_score >= 75) {
    interpretationText += `the candidate showed strong performance with a score of ${score.percentage_score}%. `;
  } else if (score.percentage_score >= 60) {
    interpretationText += `the candidate achieved a satisfactory score of ${score.percentage_score}%. `;
  } else {
    interpretationText += `the candidate's performance needs improvement with a score of ${score.percentage_score}%. `;
  }

  if (score.percentile) {
    interpretationText += `This score places them in the ${score.percentile.toFixed(1)}th percentile. `;
  }

  // Add default strengths/weaknesses/recommendations if arrays are empty
  if (strengths.length === 0) {
    if (score.percentage_score >= 90) {
      strengths.push({
        category: 'Overall Performance',
        score: score.percentage_score,
        message: `Outstanding overall performance with a score of ${score.percentage_score}%`
      });
      strengths.push({
        category: 'Test Completion',
        score: 100,
        message: 'Successfully completed all test questions'
      });
    } else if (score.percentage_score >= 75) {
      strengths.push({
        category: 'Overall Performance',
        score: score.percentage_score,
        message: `Strong overall performance with a score of ${score.percentage_score}%`
      });
    } else if (score.percentage_score >= 60) {
      strengths.push({
        category: 'Overall Performance',
        score: score.percentage_score,
        message: `Satisfactory performance with a score of ${score.percentage_score}%`
      });
    }
  }

  if (weaknesses.length === 0 && score.percentage_score < 75) {
    if (score.percentage_score < 60) {
      weaknesses.push({
        category: 'Overall Performance',
        score: score.percentage_score,
        message: `Performance below passing threshold. Focus on improving fundamental concepts.`
      });
    } else {
      weaknesses.push({
        category: 'Performance Enhancement',
        score: score.percentage_score,
        message: `There is room for improvement to reach higher performance levels.`
      });
    }
  }

  if (recommendations.length === 0) {
    if (score.percentage_score >= 90) {
      recommendations.push({
        category: 'Continued Excellence',
        suggestion: 'Maintain this high level of performance and continue building on existing strengths.'
      });
    } else if (score.percentage_score >= 75) {
      recommendations.push({
        category: 'Performance Enhancement',
        suggestion: 'Continue practicing to reach exceptional performance levels.'
      });
    } else if (score.percentage_score >= 60) {
      recommendations.push({
        category: 'Skill Development',
        suggestion: 'Focus on areas that need improvement and practice regularly to enhance performance.'
      });
    } else {
      recommendations.push({
        category: 'Fundamental Review',
        suggestion: 'Review basic concepts and seek additional learning resources to improve understanding.'
      });
      recommendations.push({
        category: 'Practice',
        suggestion: 'Engage in regular practice sessions to strengthen knowledge and skills.'
      });
    }
  }

  if (strengths.length > 0) {
    interpretationText += `Key strengths include: ${strengths.map(s => s.category).join(', ')}. `;
  }

  if (weaknesses.length > 0) {
    interpretationText += `Areas for improvement include: ${weaknesses.map(w => w.category).join(', ')}.`;
  }

  return {
    interpretation_text: interpretationText,
    strengths,
    weaknesses,
    recommendations,
    confidence_score: 0.75
  };
};

// Get interpretation
const getInterpretation = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Verify access
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

    const [interpretations] = await db.pool.execute(
      'SELECT * FROM ai_interpretations WHERE attempt_id = ?',
      [attempt_id]
    );

    if (interpretations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Interpretation not found'
      });
    }

    const interpretation = interpretations[0];
    interpretation.strengths = typeof interpretation.strengths === 'string' 
      ? JSON.parse(interpretation.strengths) 
      : interpretation.strengths;
    interpretation.weaknesses = typeof interpretation.weaknesses === 'string' 
      ? JSON.parse(interpretation.weaknesses) 
      : interpretation.weaknesses;
    interpretation.recommendations = typeof interpretation.recommendations === 'string' 
      ? JSON.parse(interpretation.recommendations) 
      : interpretation.recommendations;

    res.json({
      success: true,
      data: interpretation
    });
  } catch (error) {
    logger.error('Get interpretation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching interpretation',
      error: error.message
    });
  }
};

module.exports = {
  generateInterpretation,
  getInterpretation
};

