const db = require('../config/database');
const logger = require('../utils/logger');
const { checkAttemptLimit, logIPAddress } = require('../middleware/antiCheat');
const scoring = require('../utils/scoring');
const integrityScoring = require('../utils/integrityScoring');
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

    // Get updated attempt data with all fields (including latest violation counts)
    const [updatedAttempts] = await db.pool.execute(
      `SELECT * FROM test_attempts WHERE id = ?`,
      [attempt_id]
    );
    const updatedAttempt = updatedAttempts[0] || attempt;

    // Get latest counts from database
    const tabSwitches = updatedAttempt.tab_switch_count || updatedAttempt.tab_switches || 0;
    const fullscreenExits = updatedAttempt.fullscreen_exit_count || 0;
    
    logger.info(`Attempt ${attempt_id} violation counts: ${tabSwitches} tab switches, ${fullscreenExits} fullscreen exits`);

    // Calculate all scores first to get test score
    logger.info(`Calculating scores for attempt ${attempt_id}...`);
    const scoreData = await scoring.calculateAllScores(
      attempt_id,
      attempt.test_id,
      attempt.candidate_id
    );
    logger.info(`Scores calculated. Category scores: ${Object.keys(scoreData.category_scores || {}).length} categories`);

    // Calculate comprehensive integrity assessment (uses latest counts from database)
    logger.info(`Calculating integrity assessment for attempt ${attempt_id}...`);
    const integrityAssessment = await integrityScoring.calculateIntegrityAssessment(
      attempt_id,
      attempt.test_id,
      scoreData.percentage_score
    );
    
    const violationScore = integrityAssessment.riskScore;
    const riskLevel = integrityAssessment.riskLevel;
    const confidenceIndex = integrityAssessment.confidenceIndex;
    const recommendation = integrityAssessment.recommendation;
    
    logger.info(`Integrity assessment completed:`);
    logger.info(`  Tab Switches: ${tabSwitches}`);
    logger.info(`  Fullscreen Exits: ${fullscreenExits}`);
    logger.info(`  Risk Score: ${violationScore}`);
    logger.info(`  Risk Level: ${riskLevel}`);
    logger.info(`  Confidence Index: ${confidenceIndex}%`);
    logger.info(`  Recommendation: ${recommendation.action} - ${recommendation.message}`);

    // Update attempt status with violation data
    // Ensure all counts and scores are properly stored
    await db.pool.execute(
      `UPDATE test_attempts 
       SET status = 'completed', 
           submitted_at = NOW(), 
           time_taken_seconds = ?,
           violation_score = ?,
           tab_switches = ?,
           tab_switch_count = ?,
           fullscreen_exit_count = ?,
           suspicion_risk_level = ?
       WHERE id = ?`,
      [timeTaken, violationScore, tabSwitches, tabSwitches, fullscreenExits, riskLevel, attempt_id]
    );
    
    logger.info(`Attempt ${attempt_id} updated with: violation_score=${violationScore}, tab_switches=${tabSwitches}, fullscreen_exits=${fullscreenExits}, risk_level=${riskLevel}`);

    // Update scores table with integrity assessment data
    // Note: risk_level enum may need to be updated to include 'critical'
    // For now, we'll map 'critical' to 'high' if the enum doesn't support it
    const dbRiskLevel = riskLevel === 'critical' ? 'high' : riskLevel;
    
    // Prepare integrity recommendation JSON
    const integrityRecommendationJson = JSON.stringify({
      action: recommendation.action,
      status: recommendation.status,
      message: recommendation.message,
      requiresReview: recommendation.requiresReview,
      requiresRetest: recommendation.requiresRetest,
      reviewReason: recommendation.reviewReason || null
    });
    
    // Update scores table - use try/catch for fields that might not exist yet
    try {
      await db.pool.execute(
        `UPDATE scores 
         SET violation_score = ?, 
             risk_level = ?,
             recommendation_status = ?,
             confidence_index = ?,
             integrity_recommendation = ?
         WHERE attempt_id = ?`,
        [violationScore, dbRiskLevel, recommendation.status, confidenceIndex, integrityRecommendationJson, attempt_id]
      );
      logger.info(`Scores table updated with integrity assessment data`);
    } catch (error) {
      // If new fields don't exist, update without them (for backward compatibility)
      if (error.message.includes('Unknown column')) {
        logger.warn(`Some integrity fields not found, updating with available fields only`);
        await db.pool.execute(
          `UPDATE scores 
           SET violation_score = ?, 
               risk_level = ?,
               recommendation_status = ?
           WHERE attempt_id = ?`,
          [violationScore, dbRiskLevel, recommendation.status, attempt_id]
        );
        logger.info(`Scores table updated (limited fields)`);
      } else {
        throw error;
      }
    }
    
    // Store full integrity assessment in attempt metadata for detailed reporting
    const integrityMetadata = {
      riskScore: violationScore,
      riskLevel: riskLevel,
      confidenceIndex: confidenceIndex,
      recommendation: recommendation,
      violations: integrityAssessment.violations,
      timePatterns: {
        rapidAnswering: integrityAssessment.timePatterns.rapidAnswering,
        uniformPattern: integrityAssessment.timePatterns.uniformPattern,
        unrealisticTime: integrityAssessment.timePatterns.unrealisticTime,
        averageTimePerQuestion: integrityAssessment.timePatterns.averageTimePerQuestion,
        flags: integrityAssessment.timePatterns.flags
      }
    };
    
    await db.pool.execute(
      `UPDATE test_attempts 
       SET metadata = JSON_SET(COALESCE(metadata, '{}'), '$.integrity_assessment', ?)
       WHERE id = ?`,
      [JSON.stringify(integrityMetadata), attempt_id]
    );
    logger.info(`Integrity assessment metadata stored`);
    
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

    // Format integrity report for response
    const integrityReport = integrityScoring.formatIntegrityReport({
      testScore: scoreData.percentage_score,
      riskScore: violationScore,
      riskLevel: riskLevel,
      violations: integrityAssessment.violations,
      timePatterns: integrityAssessment.timePatterns,
      confidenceIndex: confidenceIndex,
      recommendation: recommendation
    });

    res.json({
      success: true,
      message: 'Test attempt submitted successfully',
      data: {
        attempt_id,
        score: scoreData,
        integrity: {
          riskScore: violationScore,
          riskLevel: riskLevel,
          confidenceIndex: confidenceIndex,
          recommendation: recommendation,
          report: integrityReport
        }
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
    let integrity = null;
    
    if (scores.length > 0) {
      score = scores[0];
      score.category_scores = typeof score.category_scores === 'string' 
        ? JSON.parse(score.category_scores) 
        : score.category_scores;
      
      // Build integrity assessment from score data
      if (score.violation_score !== null || score.risk_level || score.confidence_index !== null) {
        const integrityRecommendation = score.integrity_recommendation
          ? (typeof score.integrity_recommendation === 'string'
              ? JSON.parse(score.integrity_recommendation)
              : score.integrity_recommendation)
          : null;
        
        integrity = {
          riskScore: score.violation_score || 0,
          riskLevel: score.risk_level || 'low',
          confidenceIndex: score.confidence_index,
          recommendation: integrityRecommendation || {
            action: 'flag_for_review',
            status: score.recommendation_status || 'consider',
            message: 'Review recommended'
          }
        };
        
        // If metadata has integrity assessment, use that for more details
        if (attempts[0].metadata) {
          const metadata = typeof attempts[0].metadata === 'string'
            ? JSON.parse(attempts[0].metadata)
            : attempts[0].metadata;
          
          if (metadata.integrity_assessment) {
            integrity = {
              ...integrity,
              ...metadata.integrity_assessment
            };
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...attempts[0],
        answers: parsedAnswers,
        score,
        integrity
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

// Track tab switch and fullscreen exit
const trackTabSwitch = async (req, res) => {
  try {
    const { attempt_id, tab_switch, fullscreen_exit } = req.body;

    if (!attempt_id) {
      return res.status(400).json({
        success: false,
        message: 'attempt_id is required'
      });
    }

    // Update both tab_switches and tab_switch_count for backward compatibility
    if (tab_switch) {
      await db.pool.execute(
        `UPDATE test_attempts 
         SET tab_switches = tab_switches + 1,
             tab_switch_count = COALESCE(tab_switch_count, 0) + 1
         WHERE id = ?`,
        [attempt_id]
      );
      logger.info(`Tab switch tracked for attempt ${attempt_id}`);
    }

    // Track fullscreen exit
    if (fullscreen_exit) {
      await db.pool.execute(
        `UPDATE test_attempts 
         SET fullscreen_exit_count = COALESCE(fullscreen_exit_count, 0) + 1
         WHERE id = ?`,
        [attempt_id]
      );
      logger.info(`Fullscreen exit tracked for attempt ${attempt_id}`);
    }

    // Get current counts and suspicious activity
    const [attempts] = await db.pool.execute(
      `SELECT tab_switches, 
              tab_switch_count, 
              fullscreen_exit_count,
              suspicious_activity
       FROM test_attempts 
       WHERE id = ?`,
      [attempt_id]
    );

    const attempt = attempts[0];
    const tabSwitches = attempt.tab_switch_count || attempt.tab_switches || 0;
    const fullscreenExits = attempt.fullscreen_exit_count || 0;

    // Calculate violation score in real-time
    const integrityScoring = require('../utils/integrityScoring');
    const suspiciousActivity = attempt.suspicious_activity
      ? (typeof attempt.suspicious_activity === 'string'
          ? JSON.parse(attempt.suspicious_activity)
          : attempt.suspicious_activity)
      : null;

    const { riskScore, violations } = integrityScoring.calculateViolationScore(
      {
        tab_switch_count: tabSwitches,
        tab_switches: tabSwitches,
        fullscreen_exit_count: fullscreenExits,
        suspicious_activity: attempt.suspicious_activity
      },
      suspiciousActivity
    );

    // Determine risk level
    const riskLevel = integrityScoring.getRiskLevel(riskScore);

    // Update violation_score and suspicion_risk_level in real-time
    await db.pool.execute(
      `UPDATE test_attempts 
       SET violation_score = ?,
           suspicion_risk_level = ?
       WHERE id = ?`,
      [riskScore, riskLevel, attempt_id]
    );

    logger.info(`Violation score updated for attempt ${attempt_id}: ${riskScore} (${riskLevel})`);

    res.json({
      success: true,
      data: {
        tab_switches: tabSwitches,
        tab_switch_count: tabSwitches,
        fullscreen_exit_count: fullscreenExits,
        violation_score: riskScore,
        risk_level: riskLevel,
        violations: violations
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

