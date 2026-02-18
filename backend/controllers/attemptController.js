const db = require('../config/database');
const logger = require('../utils/logger');
const { checkAttemptLimit, logIPAddress } = require('../middleware/antiCheat');
const scoring = require('../utils/scoring');
const comprehensiveReportController = require('./comprehensiveReportController');
const kraKpiCalculator = require('../utils/kraKpiCalculator');

// Start test attempt
const startAttempt = async (req, res) => {
  try {
    const { test_id, candidate_id } = req.body;
    // Support both admin and candidate authentication
    const companyId = req.companyId || req.user?.company_id || req.candidate?.company_id;
    
    // Get candidate ID: from body (admin assigning) or from authenticated candidate
    let candidateId = candidate_id;
    if (!candidateId && req.candidate) {
      candidateId = req.candidate.id;
    }

    if (!test_id) {
      return res.status(400).json({
        success: false,
        message: 'test_id is required'
      });
    }

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'candidate_id is required. Please ensure you are logged in as a candidate.'
      });
    }

    // Verify test exists
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

    if (test.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Test is not active'
      });
    }

    // Check if test is assigned to candidate (if candidate is taking the test)
    if (req.candidate) {
      const [assignments] = await db.pool.execute(
        `SELECT * FROM test_assignments 
         WHERE test_id = ? AND candidate_id = ? AND status != 'expired'`,
        [test_id, candidateId]
      );

      if (assignments.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'This test has not been assigned to you'
        });
      }

      const assignment = assignments[0];
      
      // Check if due date has passed
      if (assignment.due_date && new Date(assignment.due_date) < new Date()) {
        return res.status(403).json({
          success: false,
          message: 'This test assignment has expired'
        });
      }
    }

    // Check for existing in-progress attempt first
    const [existingAttempts] = await db.pool.execute(
      `SELECT id, attempt_number, started_at 
       FROM test_attempts 
       WHERE test_id = ? AND candidate_id = ? AND status = 'in_progress'
       ORDER BY started_at DESC
       LIMIT 1`,
      [test_id, candidateId]
    );

    // If there's an in-progress attempt, return it instead of creating a new one
    if (existingAttempts.length > 0) {
      const existingAttempt = existingAttempts[0];
      logger.info(`Resuming existing attempt: ${existingAttempt.id} for test ${test_id}`);
      
      return res.json({
        success: true,
        message: 'Resuming existing test attempt',
        data: {
          attempt_id: existingAttempt.id,
          started_at: existingAttempt.started_at,
          test: {
            id: test.id,
            title: test.title,
            duration_minutes: test.duration_minutes,
            instructions: test.instructions
          },
          is_resumed: true
        }
      });
    }

    // Check attempt limit
    const [attempts] = await db.pool.execute(
      'SELECT COUNT(*) as count FROM test_attempts WHERE test_id = ? AND candidate_id = ?',
      [test_id, candidateId]
    );

    const attemptCount = attempts[0].count;

    if (attemptCount >= (test.max_attempts || 1)) {
      return res.status(403).json({
        success: false,
        message: `Maximum attempts (${test.max_attempts}) reached for this test`
      });
    }

    // Get IP address
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    // Create attempt
    const [result] = await db.pool.execute(
      `INSERT INTO test_attempts 
       (test_id, candidate_id, attempt_number, status, ip_address, user_agent)
       VALUES (?, ?, ?, 'in_progress', ?, ?)`,
      [test_id, candidateId, attemptCount + 1, ipAddress, userAgent]
    );

    // Update assignment status to 'in_progress' if candidate is taking the test
    if (req.candidate) {
      await db.pool.execute(
        `UPDATE test_assignments SET status = 'in_progress' WHERE test_id = ? AND candidate_id = ?`,
        [test_id, candidateId]
      );
    }

    logger.info(`Test attempt started: ${result.insertId} for test ${test_id}`);

    // Get the created attempt to return started_at
    const [newAttempt] = await db.pool.execute(
      'SELECT started_at FROM test_attempts WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Test attempt started',
      data: {
        attempt_id: result.insertId,
        started_at: newAttempt[0]?.started_at || new Date().toISOString(),
        test: {
          id: test.id,
          title: test.title,
          duration_minutes: test.duration_minutes,
          instructions: test.instructions
        },
        is_resumed: false
      }
    });
  } catch (error) {
    logger.error('Start attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting test attempt',
      error: error.message
    });
  }
};

// Submit answer
const submitAnswer = async (req, res) => {
  try {
    const { attempt_id, question_id, answer_data } = req.body;

    if (!attempt_id || !question_id || !answer_data) {
      return res.status(400).json({
        success: false,
        message: 'attempt_id, question_id, and answer_data are required'
      });
    }

    // Verify attempt exists and is in progress
    const [attempts] = await db.pool.execute(
      'SELECT * FROM test_attempts WHERE id = ? AND status = ?',
      [attempt_id, 'in_progress']
    );

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found or already submitted'
      });
    }

    // Get question
    const [questions] = await db.pool.execute(
      'SELECT * FROM questions WHERE id = ?',
      [question_id]
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const question = questions[0];

    // Get test settings
    const [tests] = await db.pool.execute(
      'SELECT * FROM tests WHERE id = ?',
      [attempts[0].test_id]
    );

    const test = tests[0];
    const testSettings = {
      negative_marking: test.negative_marking || false,
      negative_mark_percentage: test.negative_mark_percentage || 0
    };

    // Calculate score
    const scoreResult = scoring.calculateAnswerScore(question, answer_data, testSettings);

    // Check if answer already exists
    const [existingAnswers] = await db.pool.execute(
      'SELECT id FROM answers WHERE attempt_id = ? AND question_id = ?',
      [attempt_id, question_id]
    );

    if (existingAnswers.length > 0) {
      // Update existing answer
      await db.query(
        `UPDATE answers SET answer_data = ?, is_correct = ?, points_earned = ?, answered_at = NOW()
         WHERE attempt_id = ? AND question_id = ?`,
        [
          JSON.stringify(answer_data),
          scoreResult.isCorrect,
          scoreResult.points,
          attempt_id,
          question_id
        ]
      );
    } else {
      // Insert new answer
      await db.query(
        `INSERT INTO answers (attempt_id, question_id, answer_data, is_correct, points_earned)
         VALUES (?, ?, ?, ?, ?)`,
        [
          attempt_id,
          question_id,
          JSON.stringify(answer_data),
          scoreResult.isCorrect,
          scoreResult.points
        ]
      );
    }

    res.json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        is_correct: scoreResult.isCorrect,
        points_earned: scoreResult.points
      }
    });
  } catch (error) {
    logger.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting answer',
      error: error.message
    });
  }
};

// Submit attempt (finalize)
const submitAttempt = async (req, res) => {
  try {
    const { attempt_id } = req.body;

    if (!attempt_id) {
      return res.status(400).json({
        success: false,
        message: 'attempt_id is required'
      });
    }

    // Support both admin and candidate access
    const companyId = req.companyId || req.user?.company_id || req.candidate?.company_id;
    const candidateId = req.candidate?.id;

    // Get attempt with access control (include company_id from test)
    let query = 'SELECT ta.*, t.company_id FROM test_attempts ta JOIN tests t ON ta.test_id = t.id WHERE ta.id = ?';
    let params = [attempt_id];
    
    if (candidateId) {
      query += ' AND ta.candidate_id = ?';
      params.push(candidateId);
    } else if (companyId) {
      query += ' AND t.company_id = ?';
      params.push(companyId);
    }

    const [attempts] = await db.pool.execute(query, params);

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    const attempt = attempts[0];

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Attempt already submitted'
      });
    }

    // Calculate time taken
    const startedAt = new Date(attempt.started_at);
    const submittedAt = new Date();
    const timeTaken = Math.floor((submittedAt - startedAt) / 1000);

    // Get updated attempt data with all fields
    const [updatedAttempts] = await db.pool.execute(
      'SELECT * FROM test_attempts WHERE id = ?',
      [attempt_id]
    );
    const updatedAttempt = updatedAttempts[0] || attempt;

    // Calculate violation score
    let violationScore = 0;
    let riskLevel = 'low';
    
    // Handle both old (tab_switches) and new (tab_switch_count) column names
    const tabSwitches = updatedAttempt.tab_switch_count || updatedAttempt.tab_switches || 0;
    const fullscreenExits = updatedAttempt.fullscreen_exit_count || 0;
    
    violationScore += tabSwitches * 2;
    violationScore += fullscreenExits * 3;

    // Check suspicious activity
    const suspiciousActivity = updatedAttempt.suspicious_activity 
      ? (typeof updatedAttempt.suspicious_activity === 'string' 
          ? JSON.parse(updatedAttempt.suspicious_activity) 
          : updatedAttempt.suspicious_activity)
      : null;

    if (suspiciousActivity) {
      if (suspiciousActivity.copy) violationScore += 5;
      if (suspiciousActivity.paste) violationScore += 5;
      if (suspiciousActivity.right_click) violationScore += 3;
      if (suspiciousActivity.dev_tools) violationScore += 10;
    }

    // Determine risk level
    if (violationScore >= 20) riskLevel = 'high';
    else if (violationScore >= 10) riskLevel = 'medium';

    // Update attempt status with violation data
    await db.query(
      `UPDATE test_attempts 
       SET status = 'completed', 
           submitted_at = NOW(), 
           time_taken_seconds = ?,
           violation_score = ?,
           tab_switch_count = ?,
           fullscreen_exit_count = ?,
           suspicion_risk_level = ?
       WHERE id = ?`,
      [timeTaken, violationScore, tabSwitches, fullscreenExits, riskLevel, attempt_id]
    );

    // Calculate all scores
    logger.info(`Calculating scores for attempt ${attempt_id}...`);
    const scoreData = await scoring.calculateAllScores(
      attempt_id,
      attempt.test_id,
      attempt.candidate_id
    );
    logger.info(`Scores calculated. Category scores: ${Object.keys(scoreData.category_scores || {}).length} categories`);

    // Update scores table with violation score
    await db.pool.execute(
      `UPDATE scores 
       SET violation_score = ?, risk_level = ?
       WHERE attempt_id = ?`,
      [violationScore, riskLevel, attempt_id]
    );
    logger.info(`Scores table updated with violation data`);
    
    // IMPORTANT: Wait a moment to ensure scores are fully committed to database
    // Then verify scores exist before proceeding with KRA/KPI calculation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify scores are saved
    const [verifyScores] = await db.pool.execute(
      'SELECT category_scores FROM scores WHERE attempt_id = ?',
      [attempt_id]
    );
    
    if (verifyScores.length === 0) {
      logger.error(`❌ Scores not found after calculation for attempt ${attempt_id}`);
    } else {
      logger.info(`✓ Verified scores are saved to database`);
    }

    // Generate comprehensive report data (HR Detailed Report)
    try {
      await comprehensiveReportController.generateComprehensiveReportData(
        attempt_id,
        'hr_detailed'
      );
      logger.info(`Comprehensive report generated for attempt: ${attempt_id}`);
    } catch (reportError) {
      // Log error but don't fail the submission
      logger.error(`Error generating comprehensive report for attempt ${attempt_id}:`, reportError);
    }

    // Generate candidate summary report
    try {
      await comprehensiveReportController.generateComprehensiveReportData(
        attempt_id,
        'candidate_summary'
      );
      logger.info(`Candidate summary report generated for attempt: ${attempt_id}`);
    } catch (reportError) {
      logger.error(`Error generating candidate summary for attempt ${attempt_id}:`, reportError);
    }

    // Automatically calculate and store KRA/KPI performance from test results
    // IMPORTANT: This must run AFTER scores are calculated and saved
    try {
      const testCompanyId = attempt.company_id || companyId || req.user?.company_id;
      if (!testCompanyId) {
        logger.warn(`⚠️  Company ID not found for attempt ${attempt_id}, skipping KRA/KPI calculation`);
        logger.warn(`   attempt.company_id: ${attempt.company_id}`);
        logger.warn(`   companyId: ${companyId}`);
        logger.warn(`   req.user?.company_id: ${req.user?.company_id}`);
      } else {
        // Double-check scores are saved before calculating KRA/KPI
        const [verifyScores] = await db.pool.execute(
          'SELECT category_scores FROM scores WHERE attempt_id = ?',
          [attempt_id]
        );
        
        if (verifyScores.length === 0) {
          logger.error(`❌ Scores not found for attempt ${attempt_id}, cannot calculate KRA/KPI`);
        } else if (!verifyScores[0].category_scores) {
          logger.error(`❌ Category scores are null for attempt ${attempt_id}, cannot calculate KRA/KPI`);
        } else {
          logger.info(`\n🔄 Triggering KRA/KPI calculation...`);
          logger.info(`   Attempt: ${attempt_id}`);
          logger.info(`   Test: ${attempt.test_id}`);
          logger.info(`   Candidate: ${attempt.candidate_id}`);
          logger.info(`   Company: ${testCompanyId}`);
          
          const result = await kraKpiCalculator.calculateAndStoreKRAKPIPerformance(
            attempt_id,
            attempt.test_id,
            attempt.candidate_id,
            testCompanyId
          );
          
          if (result && result.success) {
            logger.info(`✅ KRA/KPI calculation completed successfully`);
            logger.info(`   Summary: ${JSON.stringify(result.summary)}`);
          } else {
            logger.warn(`⚠️  KRA/KPI calculation completed with warnings: ${result?.message || 'Unknown error'}`);
            if (result?.details) {
              logger.warn(`   Details: ${result.details}`);
            }
          }
        }
      }
    } catch (kraKpiError) {
      // Log error but don't fail the submission
      logger.error(`\n❌❌❌ ERROR in KRA/KPI calculation ❌❌❌`);
      logger.error(`Attempt ID: ${attempt_id}`);
      logger.error(`Error:`, kraKpiError);
      logger.error(`Stack:`, kraKpiError.stack);
      console.error('KRA/KPI Calculation Error Details:', {
        attemptId: attempt_id,
        testId: attempt.test_id,
        candidateId: attempt.candidate_id,
        companyId: attempt.company_id || companyId || req.user?.company_id,
        error: kraKpiError.message,
        stack: kraKpiError.stack
      });
    }

    logger.info(`Test attempt submitted: ${attempt_id} with violation score: ${violationScore}`);

    res.json({
      success: true,
      message: 'Test attempt submitted successfully',
      data: {
        attempt_id,
        score: scoreData,
        violation_score: violationScore,
        risk_level: riskLevel
      }
    });
  } catch (error) {
    logger.error('Submit attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting attempt',
      error: error.message
    });
  }
};

// Get attempt details (candidates can view their own, admins can view any)
const getAttempt = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user?.company_id || req.candidate?.company_id;
    
    // If candidate is accessing, verify it's their own attempt
    if (req.candidate) {
      const [candidateAttempts] = await db.pool.execute(
        'SELECT id FROM test_attempts WHERE id = ? AND candidate_id = ?',
        [id, req.candidate.id]
      );
      
      if (candidateAttempts.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own test attempts'
        });
      }
    }

    const [attempts] = await db.pool.execute(
      `SELECT ta.*, t.title as test_title, c.first_name, c.last_name, c.email
       FROM test_attempts ta
       JOIN tests t ON ta.test_id = t.id
       JOIN candidates c ON ta.candidate_id = c.id
       WHERE ta.id = ? AND t.company_id = ?`,
      [id, companyId]
    );

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    // Get answers with correct answers and scoring info
    const answers = await db.query(
      `SELECT a.*, q.question_text, q.question_type, q.points, q.correct_answer, 
              q.negative_points, q.explanation,
              CASE 
                WHEN a.answer_data = q.correct_answer THEN q.points
                WHEN q.negative_points > 0 THEN -q.negative_points
                ELSE 0
              END as marks_obtained
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.attempt_id = ?
       ORDER BY a.answered_at ASC`,
      [id]
    );

    // Parse JSON fields and add correct answer info
    const parsedAnswers = answers.map(a => {
      const answerData = typeof a.answer_data === 'string' ? JSON.parse(a.answer_data) : a.answer_data;
      const correctAnswer = typeof a.correct_answer === 'string' ? JSON.parse(a.correct_answer) : a.correct_answer;
      
      // Check if answer is correct
      let isCorrect = false;
      if (Array.isArray(correctAnswer) && Array.isArray(answerData)) {
        isCorrect = JSON.stringify(correctAnswer.sort()) === JSON.stringify(answerData.sort());
      } else {
        isCorrect = JSON.stringify(correctAnswer) === JSON.stringify(answerData);
      }
      
      return {
        ...a,
        answer_data: answerData,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
        marks_obtained: a.marks_obtained || (isCorrect ? parseFloat(a.points) : (a.negative_points ? -parseFloat(a.negative_points) : 0))
      };
    });

    // Get score if available
    const [scores] = await db.pool.execute(
      'SELECT * FROM scores WHERE attempt_id = ?',
      [id]
    );

    let score = null;
    if (scores.length > 0) {
      score = scores[0];
      score.category_scores = typeof score.category_scores === 'string' 
        ? JSON.parse(score.category_scores) 
        : score.category_scores;
    }

    res.json({
      success: true,
      data: {
        ...attempts[0],
        answers: parsedAnswers,
        score
      }
    });
  } catch (error) {
    logger.error('Get attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attempt',
      error: error.message
    });
  }
};

// Track tab switch
const trackTabSwitch = async (req, res) => {
  try {
    const { attempt_id } = req.body;

    if (!attempt_id) {
      return res.status(400).json({
        success: false,
        message: 'attempt_id is required'
      });
    }

    // Increment tab switch count
    await db.query(
      'UPDATE test_attempts SET tab_switches = tab_switches + 1 WHERE id = ?',
      [attempt_id]
    );

    // Get current count
    const [attempts] = await db.pool.execute(
      'SELECT tab_switches FROM test_attempts WHERE id = ?',
      [attempt_id]
    );

    res.json({
      success: true,
      data: {
        tab_switches: attempts[0].tab_switches
      }
    });
  } catch (error) {
    logger.error('Track tab switch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking tab switch',
      error: error.message
    });
  }
};

module.exports = {
  startAttempt,
  submitAnswer,
  submitAttempt,
  getAttempt,
  trackTabSwitch
};

