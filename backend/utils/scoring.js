const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Calculate score for a single answer
 */
const calculateAnswerScore = (question, answer, testSettings) => {
  const isCorrect = checkAnswer(question, answer);
  let points = 0;

  if (isCorrect) {
    points = parseFloat(question.points) || 1.0;
  } else if (testSettings.negative_marking) {
    // Apply negative marking
    const negativePercentage = parseFloat(testSettings.negative_mark_percentage) || 0;
    const negativePoints = (parseFloat(question.points) || 1.0) * (negativePercentage / 100);
    points = -negativePoints;
  }

  return {
    isCorrect,
    points: parseFloat(points.toFixed(2))
  };
};

/**
 * Check if answer is correct
 */
const checkAnswer = (question, userAnswer) => {
  try {
    // Parse correct answer
    let correctAnswer = question.correct_answer;
    if (typeof correctAnswer === 'string') {
      try {
        correctAnswer = JSON.parse(correctAnswer);
      } catch (e) {
        // If parsing fails, treat as plain string
        correctAnswer = correctAnswer;
      }
    }
    
    // Parse user answer
    let answer = userAnswer;
    if (typeof answer === 'string') {
      try {
        answer = JSON.parse(answer);
      } catch (e) {
        // If parsing fails, treat as plain string
        answer = answer;
      }
    }

    // Normalize values for comparison (trim strings, handle case-insensitive for text)
    const normalize = (val) => {
      if (typeof val === 'string') {
        return val.trim().toLowerCase();
      }
      if (Array.isArray(val)) {
        return val.map(v => typeof v === 'string' ? v.trim().toLowerCase() : v).sort();
      }
      return val;
    };

    // Handle different question types
    const questionType = question.question_type || '';
    
    // Multiple choice types (MCQ_MULTI, RANKING)
    if (questionType === 'MCQ_MULTI' || questionType === 'RANKING' || questionType === 'multiple_choice') {
      // For multiple choice and ranking, check if arrays match (order matters for ranking)
      if (Array.isArray(correctAnswer) && Array.isArray(answer)) {
        if (questionType === 'RANKING') {
          // For ranking, order matters - must match exactly
          return JSON.stringify(correctAnswer) === JSON.stringify(answer);
        } else {
          // For multiple choice, order doesn't matter
          const normalizedCorrect = normalize(correctAnswer);
          const normalizedAnswer = normalize(answer);
          return JSON.stringify(normalizedCorrect) === JSON.stringify(normalizedAnswer);
        }
      }
      // Fallback: try string comparison
      return JSON.stringify(correctAnswer) === JSON.stringify(answer);
    }
    
    // Numeric type
    if (questionType === 'NUMERIC') {
      const correctNum = parseFloat(correctAnswer);
      const answerNum = parseFloat(answer);
      return !isNaN(correctNum) && !isNaN(answerNum) && correctNum === answerNum;
    }
    
    // Single choice types (MCQ_SINGLE, TRUE_FALSE, LIKERT, SJT, single_choice, true_false, rating_scale)
    // For single choice, compare values (case-insensitive for strings)
    if (typeof correctAnswer === 'string' && typeof answer === 'string') {
      return normalize(correctAnswer) === normalize(answer);
    }
    
    // Default: strict comparison
    return JSON.stringify(correctAnswer) === JSON.stringify(answer);
  } catch (error) {
    logger.error('Error checking answer:', error);
    return false;
  }
};

/**
 * Calculate category scores
 */
const calculateCategoryScores = async (attemptId, testId) => {
  try {
    // Get all answers for this attempt
    const answers = await db.query(
      `SELECT a.*, q.category_id, q.points, q.negative_points, q.correct_answer, q.question_type
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.attempt_id = ?`,
      [attemptId]
    );

    // Get test settings
    const [tests] = await db.pool.execute(
      'SELECT * FROM tests WHERE id = ?',
      [testId]
    );

    if (tests.length === 0) {
      throw new Error('Test not found');
    }

    const test = tests[0];
    const testSettings = {
      negative_marking: test.negative_marking || false,
      negative_mark_percentage: test.negative_mark_percentage || 0
    };

    // Get category mappings for this test
    let categories = await db.query(
      `SELECT tcm.*, tc.name, tc.reverse_score, tc.weight
       FROM test_categories_mapping tcm
       JOIN test_categories tc ON tcm.category_id = tc.id
       WHERE tcm.test_id = ?`,
      [testId]
    );

    // If no categories mapped via test_categories_mapping, get categories from questions directly
    if (categories.length === 0) {
      logger.info(`No test_categories_mapping found for test ${testId}, using question categories directly`);
      
      // Get unique category IDs from questions in this test
      const [testQuestions] = await db.pool.execute(
        `SELECT DISTINCT q.category_id
         FROM test_questions tq
         JOIN questions q ON tq.question_id = q.id
         WHERE tq.test_id = ? AND q.category_id IS NOT NULL`,
        [testId]
      );

      if (testQuestions.length > 0) {
        const categoryIds = testQuestions.map(tq => tq.category_id);
        
        // Get category details
        const [categoryDetails] = await db.pool.execute(
          `SELECT id, name, reverse_score, weight
           FROM test_categories
           WHERE id IN (${categoryIds.map(() => '?').join(',')})`,
          categoryIds
        );

        // Convert to same format as test_categories_mapping
        categories = categoryDetails.map(cat => ({
          category_id: cat.id,
          name: cat.name,
          reverse_score: cat.reverse_score || false,
          weight: cat.weight || 1.0
        }));

        logger.info(`Found ${categories.length} categories from questions: ${categories.map(c => c.name).join(', ')}`);
      } else {
        logger.warn(`No categories found in questions for test ${testId}. Category scores will be empty.`);
      }
    }

    // Calculate scores per category
    const categoryScores = {};

    for (const category of categories) {
      const categoryId = category.category_id;
      const categoryAnswers = answers.filter(a => a.category_id === categoryId);
      
      if (categoryAnswers.length === 0) {
        logger.debug(`No answers found for category ${category.name} (ID: ${categoryId})`);
        continue;
      }
      
      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;
      let totalCount = categoryAnswers.length;

      for (const answer of categoryAnswers) {
        const scoreResult = calculateAnswerScore(answer, answer.answer_data, testSettings);
        totalScore += scoreResult.points;
        maxScore += parseFloat(answer.points) || 1.0;
        if (scoreResult.isCorrect) correctCount++;
      }

      // Apply reverse scoring if enabled
      if (category.reverse_score) {
        totalScore = maxScore - totalScore;
      }

      // Apply category weight
      const weightedScore = totalScore * (parseFloat(category.weight) || 1.0);
      const weightedMaxScore = maxScore * (parseFloat(category.weight) || 1.0);

      categoryScores[categoryId] = {
        category_id: categoryId,
        category_name: category.name,
        score: parseFloat(weightedScore.toFixed(2)),
        max_score: parseFloat(weightedMaxScore.toFixed(2)),
        percentage: weightedMaxScore > 0 
          ? parseFloat(((weightedScore / weightedMaxScore) * 100).toFixed(2))
          : 0,
        correct_count: correctCount,
        total_count: totalCount,
        reverse_score: category.reverse_score || false,
        weight: parseFloat(category.weight) || 1.0
      };
    }

    if (Object.keys(categoryScores).length === 0) {
      logger.warn(`No category scores calculated for attempt ${attemptId}. Check if questions have category_id assigned.`);
    } else {
      logger.info(`Calculated scores for ${Object.keys(categoryScores).length} categories`);
    }

    return categoryScores;
  } catch (error) {
    logger.error('Category score calculation error:', error);
    throw error;
  }
};

/**
 * Calculate total score and percentage
 */
const calculateTotalScore = async (attemptId, testId) => {
  try {
    // Get all answers
    const answers = await db.query(
      `SELECT a.*, q.points, q.negative_points, q.correct_answer, q.question_type
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.attempt_id = ?`,
      [attemptId]
    );

    // Get test settings
    const [tests] = await db.pool.execute(
      'SELECT * FROM tests WHERE id = ?',
      [testId]
    );

    if (tests.length === 0) {
      throw new Error('Test not found');
    }

    const test = tests[0];
    const testSettings = {
      negative_marking: test.negative_marking || false,
      negative_mark_percentage: test.negative_mark_percentage || 0
    };

    let totalScore = 0;
    let maxScore = 0;

    for (const answer of answers) {
      const scoreResult = calculateAnswerScore(answer, answer.answer_data, testSettings);
      totalScore += scoreResult.points;
      maxScore += parseFloat(answer.points) || 1.0;
    }

    const percentage = maxScore > 0 
      ? parseFloat(((totalScore / maxScore) * 100).toFixed(2))
      : 0;

    return {
      total_score: parseFloat(totalScore.toFixed(2)),
      max_score: parseFloat(maxScore.toFixed(2)),
      percentage_score: percentage
    };
  } catch (error) {
    logger.error('Total score calculation error:', error);
    throw error;
  }
};

/**
 * Calculate percentile
 */
const calculatePercentile = async (testId, percentageScore) => {
  try {
    // Get all scores for this test
    const scores = await db.query(
      `SELECT percentage_score 
       FROM scores 
       WHERE test_id = ? 
       ORDER BY percentage_score ASC`,
      [testId]
    );

    if (scores.length === 0) {
      return null; // No other scores to compare
    }

    // Count scores below the candidate's score
    const scoresBelow = scores.filter(s => s.percentage_score < percentageScore).length;
    const totalScores = scores.length;

    // Calculate percentile
    const percentile = (scoresBelow / totalScores) * 100;

    return parseFloat(percentile.toFixed(2));
  } catch (error) {
    logger.error('Percentile calculation error:', error);
    return null;
  }
};

/**
 * Calculate all scores for an attempt
 */
const calculateAllScores = async (attemptId, testId, candidateId) => {
  try {
    logger.info(`[calculateAllScores] Starting score calculation for attempt ${attemptId}, test ${testId}, candidate ${candidateId}`);
    
    // Calculate category scores
    logger.info(`[calculateAllScores] Calculating category scores...`);
    const categoryScores = await calculateCategoryScores(attemptId, testId);
    logger.info(`[calculateAllScores] Category scores calculated: ${Object.keys(categoryScores).length} categories`);
    
    if (Object.keys(categoryScores).length === 0) {
      logger.warn(`[calculateAllScores] ⚠️  WARNING: No category scores calculated for attempt ${attemptId}`);
      logger.warn(`[calculateAllScores] This may be because:`);
      logger.warn(`[calculateAllScores]   1. Test has no categories mapped in test_categories_mapping`);
      logger.warn(`[calculateAllScores]   2. Questions don't have category_id assigned`);
      logger.warn(`[calculateAllScores]   3. No answers found for the categories`);
    } else {
      Object.values(categoryScores).forEach(cat => {
        logger.info(`[calculateAllScores]   - ${cat.category_name}: ${cat.percentage}%`);
      });
    }

    // Calculate total score
    logger.info(`[calculateAllScores] Calculating total score...`);
    const totalScoreData = await calculateTotalScore(attemptId, testId);
    logger.info(`[calculateAllScores] Total score: ${totalScoreData.total_score}/${totalScoreData.max_score} (${totalScoreData.percentage_score}%)`);

    // Calculate percentile if enabled
    let percentile = null;
    const [tests] = await db.pool.execute(
      'SELECT enable_percentile FROM tests WHERE id = ?',
      [testId]
    );

    if (tests.length > 0 && tests[0].enable_percentile) {
      percentile = await calculatePercentile(testId, totalScoreData.percentage_score);
    }

    // Check if passed
    const [testData] = await db.pool.execute(
      'SELECT passing_score FROM tests WHERE id = ?',
      [testId]
    );

    const passingScore = testData[0]?.passing_score || 0;
    const passed = totalScoreData.percentage_score >= passingScore;

    // Save or update score
    const categoryScoresJson = JSON.stringify(categoryScores);
    logger.info(`[calculateAllScores] Category scores JSON length: ${categoryScoresJson.length} characters`);
    logger.info(`[calculateAllScores] Category scores JSON preview: ${categoryScoresJson.substring(0, 200)}`);
    
    const scoreData = {
      attempt_id: attemptId,
      test_id: testId,
      candidate_id: candidateId,
      total_score: totalScoreData.total_score,
      max_score: totalScoreData.max_score,
      percentage_score: totalScoreData.percentage_score,
      percentile: percentile,
      category_scores: categoryScoresJson,
      passed: passed
    };

    // Check if score already exists
    const [existingScores] = await db.pool.execute(
      'SELECT id FROM scores WHERE attempt_id = ?',
      [attemptId]
    );

    if (existingScores.length > 0) {
      logger.info(`[calculateAllScores] Updating existing score record (ID: ${existingScores[0].id})`);
      await db.pool.execute(
        `UPDATE scores SET 
         total_score = ?, max_score = ?, percentage_score = ?, percentile = ?, 
         category_scores = ?, passed = ? 
         WHERE attempt_id = ?`,
        [
          scoreData.total_score,
          scoreData.max_score,
          scoreData.percentage_score,
          scoreData.percentile,
          scoreData.category_scores,
          scoreData.passed,
          attemptId
        ]
      );
      logger.info(`[calculateAllScores] ✅ Score record updated successfully`);
    } else {
      logger.info(`[calculateAllScores] Creating new score record`);
      await db.pool.execute(
        `INSERT INTO scores 
         (attempt_id, test_id, candidate_id, total_score, max_score, percentage_score, percentile, category_scores, passed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scoreData.attempt_id,
          scoreData.test_id,
          scoreData.candidate_id,
          scoreData.total_score,
          scoreData.max_score,
          scoreData.percentage_score,
          scoreData.percentile,
          scoreData.category_scores,
          scoreData.passed
        ]
      );
      logger.info(`[calculateAllScores] ✅ Score record created successfully`);
    }
    
    // Verify the save
    const [verifyScores] = await db.pool.execute(
      'SELECT category_scores FROM scores WHERE attempt_id = ?',
      [attemptId]
    );
    
    if (verifyScores.length > 0) {
      const savedCategoryScores = typeof verifyScores[0].category_scores === 'string'
        ? JSON.parse(verifyScores[0].category_scores)
        : verifyScores[0].category_scores;
      logger.info(`[calculateAllScores] ✅ Verified: ${Object.keys(savedCategoryScores || {}).length} categories saved to database`);
    }

    return {
      ...scoreData,
      category_scores: categoryScores
    };
  } catch (error) {
    logger.error('Score calculation error:', error);
    throw error;
  }
};

module.exports = {
  calculateAnswerScore,
  calculateCategoryScores,
  calculateTotalScore,
  calculatePercentile,
  calculateAllScores,
  checkAnswer
};

