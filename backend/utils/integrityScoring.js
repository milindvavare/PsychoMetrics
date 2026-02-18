/**
 * Advanced Integrity Scoring System
 * 
 * Implements weighted violation scoring, risk levels, time pattern analysis,
 * confidence index, and recommendation matrix for test integrity assessment.
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Violation point weights
 */
const VIOLATION_WEIGHTS = {
  TAB_SWITCH: 10,
  FULLSCREEN_EXIT: 15,
  COPY_ATTEMPT: 10,
  RAPID_ANSWERING: 20,
  MULTIPLE_LOGIN: 50
};

/**
 * Risk level thresholds
 */
const RISK_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 21,
  HIGH: 51,
  CRITICAL: 80
};

/**
 * Risk level labels
 */
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Calculate violation score from attempt data
 */
const calculateViolationScore = (attempt, suspiciousActivity = null) => {
  let riskScore = 0;
  const violations = {
    tab_switches: 0,
    fullscreen_exits: 0,
    copy_attempts: 0,
    rapid_answering: 0,
    multiple_login: 0
  };

  // Tab switches
  const tabSwitches = attempt.tab_switch_count || attempt.tab_switches || 0;
  violations.tab_switches = tabSwitches;
  riskScore += tabSwitches * VIOLATION_WEIGHTS.TAB_SWITCH;

  // Fullscreen exits
  const fullscreenExits = attempt.fullscreen_exit_count || 0;
  violations.fullscreen_exits = fullscreenExits;
  riskScore += fullscreenExits * VIOLATION_WEIGHTS.FULLSCREEN_EXIT;

  // Parse suspicious activity
  let suspicious = suspiciousActivity;
  if (!suspicious && attempt.suspicious_activity) {
    suspicious = typeof attempt.suspicious_activity === 'string'
      ? JSON.parse(attempt.suspicious_activity)
      : attempt.suspicious_activity;
  }

  if (suspicious) {
    // Copy attempts
    if (suspicious.copy) {
      const copyCount = typeof suspicious.copy === 'object' 
        ? (suspicious.copy.count || 1)
        : 1;
      violations.copy_attempts = copyCount;
      riskScore += copyCount * VIOLATION_WEIGHTS.COPY_ATTEMPT;
    }

    // Paste attempts (treated as copy)
    if (suspicious.paste) {
      const pasteCount = typeof suspicious.paste === 'object'
        ? (suspicious.paste.count || 1)
        : 1;
      violations.copy_attempts += pasteCount;
      riskScore += pasteCount * VIOLATION_WEIGHTS.COPY_ATTEMPT;
    }

    // Multiple login detection
    if (suspicious.multiple_login || suspicious.multiple_sessions) {
      violations.multiple_login = 1;
      riskScore += VIOLATION_WEIGHTS.MULTIPLE_LOGIN;
    }
  }

  return {
    riskScore: Math.round(riskScore),
    violations
  };
};

/**
 * Determine risk level from risk score
 */
const getRiskLevel = (riskScore) => {
  if (riskScore >= RISK_THRESHOLDS.CRITICAL) {
    return RISK_LEVELS.CRITICAL;
  } else if (riskScore >= RISK_THRESHOLDS.HIGH) {
    return RISK_LEVELS.HIGH;
  } else if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
    return RISK_LEVELS.MEDIUM;
  } else {
    return RISK_LEVELS.LOW;
  }
};

/**
 * Analyze time patterns for suspicious behavior
 */
const analyzeTimePatterns = async (attemptId, testId) => {
  try {
    // Get all answers with timestamps
    const answers = await db.query(
      `SELECT a.*, q.question_type, q.difficulty
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.attempt_id = ?
       ORDER BY a.answered_at ASC`,
      [attemptId]
    );

    if (answers.length === 0) {
      return {
        rapidAnswering: false,
        uniformPattern: false,
        unrealisticTime: false,
        averageTimePerQuestion: null,
        flags: []
      };
    }

    // Get test duration
    const [tests] = await db.pool.execute(
      'SELECT duration_minutes, total_questions FROM tests WHERE id = ?',
      [testId]
    );

    const testDurationMinutes = tests[0]?.duration_minutes || 60;
    const totalQuestions = tests[0]?.total_questions || answers.length;
    const testDurationSeconds = testDurationMinutes * 60;

    // Calculate time per question
    const timePerQuestion = [];
    let previousTimestamp = null;

    for (const answer of answers) {
      const answeredAt = new Date(answer.answered_at);
      
      if (previousTimestamp) {
        const timeDiff = Math.floor((answeredAt - previousTimestamp) / 1000);
        timePerQuestion.push(timeDiff);
      }
      
      previousTimestamp = answeredAt;
    }

    // Calculate average time per question
    const avgTimePerQuestion = timePerQuestion.length > 0
      ? timePerQuestion.reduce((sum, time) => sum + time, 0) / timePerQuestion.length
      : null;

    // Get total time taken
    const [attempts] = await db.pool.execute(
      'SELECT time_taken_seconds, started_at, submitted_at FROM test_attempts WHERE id = ?',
      [attemptId]
    );

    const attempt = attempts[0];
    let totalTimeSeconds = attempt?.time_taken_seconds || 0;

    if (!totalTimeSeconds && attempt?.started_at && attempt?.submitted_at) {
      totalTimeSeconds = Math.floor(
        (new Date(attempt.submitted_at) - new Date(attempt.started_at)) / 1000
      );
    }

    const flags = [];
    let rapidAnswering = false;
    let uniformPattern = false;
    let unrealisticTime = false;

    // Check for rapid answering (less than 5 seconds per question on average)
    if (avgTimePerQuestion !== null && avgTimePerQuestion < 5) {
      rapidAnswering = true;
      flags.push({
        type: 'rapid_answering',
        severity: 'high',
        message: `Average time per question: ${avgTimePerQuestion.toFixed(1)} seconds (suspiciously fast)`,
        averageTime: avgTimePerQuestion
      });
    }

    // Check for uniform answer pattern (all same answer)
    if (answers.length > 5) {
      const answerValues = answers.map(a => {
        const answerData = typeof a.answer_data === 'string'
          ? JSON.parse(a.answer_data)
          : a.answer_data;
        return JSON.stringify(answerData);
      });

      const uniqueAnswers = new Set(answerValues);
      if (uniqueAnswers.size === 1) {
        uniformPattern = true;
        flags.push({
          type: 'uniform_pattern',
          severity: 'medium',
          message: 'All answers are identical (suspicious pattern)'
        });
      }

      // Check if all answers are the same option (e.g., all "C")
      if (answers.length > 10) {
        const optionPatterns = answers.map(a => {
          const answerData = typeof a.answer_data === 'string'
            ? JSON.parse(a.answer_data)
            : a.answer_data;
          
          if (Array.isArray(answerData)) {
            return answerData.join(',');
          }
          return String(answerData);
        });

        const optionCounts = {};
        optionPatterns.forEach(opt => {
          optionCounts[opt] = (optionCounts[opt] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(optionCounts));
        const percentage = (maxCount / answers.length) * 100;

        if (percentage > 80) {
          uniformPattern = true;
          flags.push({
            type: 'uniform_option',
            severity: 'medium',
            message: `${percentage.toFixed(1)}% of answers are the same option`,
            dominantOption: Object.keys(optionCounts).find(k => optionCounts[k] === maxCount)
          });
        }
      }
    }

    // Check for unrealistic completion time
    // If test has 50 questions and was completed in 3 minutes, that's unrealistic
    const expectedMinTime = totalQuestions * 10; // Minimum 10 seconds per question
    const expectedMaxTime = testDurationSeconds;

    if (totalTimeSeconds > 0) {
      const timeRatio = totalTimeSeconds / totalQuestions;
      
      if (timeRatio < 5) {
        unrealisticTime = true;
        flags.push({
          type: 'unrealistic_time',
          severity: 'high',
          message: `Test completed in ${Math.floor(totalTimeSeconds / 60)} minutes for ${totalQuestions} questions (${timeRatio.toFixed(1)}s per question)`,
          timePerQuestion: timeRatio,
          totalTime: totalTimeSeconds
        });
      }

      // If completed way too fast (less than 20% of allocated time with high score)
      if (totalTimeSeconds < (testDurationSeconds * 0.2) && totalQuestions > 20) {
        unrealisticTime = true;
        flags.push({
          type: 'too_fast_completion',
          severity: 'high',
          message: `Test completed in ${Math.floor(totalTimeSeconds / 60)} minutes (${((totalTimeSeconds / testDurationSeconds) * 100).toFixed(1)}% of allocated time)`,
          completionPercentage: (totalTimeSeconds / testDurationSeconds) * 100
        });
      }
    }

    return {
      rapidAnswering,
      uniformPattern,
      unrealisticTime,
      averageTimePerQuestion: avgTimePerQuestion,
      totalTimeSeconds,
      timePerQuestion,
      flags
    };
  } catch (error) {
    logger.error('Time pattern analysis error:', error);
    return {
      rapidAnswering: false,
      uniformPattern: false,
      unrealisticTime: false,
      averageTimePerQuestion: null,
      flags: []
    };
  }
};

/**
 * Calculate confidence index
 * Confidence = Test Score - (Risk Score × Weight)
 */
const calculateConfidenceIndex = (testScore, riskScore, riskWeight = 0.5) => {
  // Normalize risk score to 0-100 scale (assuming max risk score of 200)
  const normalizedRisk = Math.min((riskScore / 200) * 100, 100);
  
  // Calculate confidence: test score minus weighted risk penalty
  const confidence = testScore - (normalizedRisk * riskWeight);
  
  // Ensure confidence is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(confidence * 100) / 100));
};

/**
 * Get recommendation based on score and risk matrix
 */
const getRecommendation = (testScore, riskLevel, riskScore, timePatternFlags = []) => {
  const hasHighRiskFlags = timePatternFlags.some(f => f.severity === 'high');
  const hasTimeIssues = timePatternFlags.some(f => 
    f.type === 'rapid_answering' || 
    f.type === 'unrealistic_time' || 
    f.type === 'too_fast_completion'
  );

  // Define score thresholds
  const HIGH_SCORE = 80;
  const MEDIUM_SCORE = 60;
  const LOW_SCORE = 40;

  // Recommendation matrix
  if (testScore >= HIGH_SCORE) {
    if (riskLevel === RISK_LEVELS.LOW) {
      return {
        action: 'accept',
        status: 'strong_hire',
        message: 'High score with low integrity risk. Candidate recommended.',
        requiresReview: false,
        requiresRetest: false
      };
    } else if (riskLevel === RISK_LEVELS.MEDIUM) {
      return {
        action: 'flag_for_review',
        status: 'consider',
        message: 'High score but medium integrity risk detected. Flag for HR review.',
        requiresReview: true,
        requiresRetest: false,
        reviewReason: 'Medium risk violations detected'
      };
    } else if (riskLevel === RISK_LEVELS.HIGH || riskLevel === RISK_LEVELS.CRITICAL) {
      if (hasTimeIssues || hasHighRiskFlags) {
        return {
          action: 'require_retest',
          status: 'not_recommended',
          message: 'High score but high/critical integrity risk with suspicious time patterns. Require supervised retest.',
          requiresReview: true,
          requiresRetest: true,
          reviewReason: `High/Critical risk (${riskScore} points) with suspicious time patterns detected`
        };
      } else {
        return {
          action: 'flag_for_review',
          status: 'consider',
          message: 'High score but high integrity risk. Flag for review and consider retest.',
          requiresReview: true,
          requiresRetest: false,
          reviewReason: `High/Critical risk violations (${riskScore} points)`
        };
      }
    }
  } else if (testScore >= MEDIUM_SCORE) {
    if (riskLevel === RISK_LEVELS.LOW || riskLevel === RISK_LEVELS.MEDIUM) {
      return {
        action: 'flag_for_review',
        status: 'consider',
        message: 'Medium score with low/medium risk. Standard review recommended.',
        requiresReview: true,
        requiresRetest: false
      };
    } else {
      return {
        action: 'require_retest',
        status: 'not_recommended',
        message: 'Medium score with high integrity risk. Require retest or reject.',
        requiresReview: true,
        requiresRetest: true,
        reviewReason: `High/Critical risk (${riskScore} points) with medium score`
      };
    }
  } else {
    // Low score
    if (riskLevel === RISK_LEVELS.HIGH || riskLevel === RISK_LEVELS.CRITICAL) {
      return {
        action: 'reject',
        status: 'reject',
        message: 'Low score with high integrity risk. Candidate not recommended.',
        requiresReview: false,
        requiresRetest: false,
        reviewReason: `Low score (${testScore}%) with high risk (${riskScore} points)`
      };
    } else {
      return {
        action: 'flag_for_review',
        status: 'not_recommended',
        message: 'Low score. Review recommended.',
        requiresReview: true,
        requiresRetest: false
      };
    }
  }

  // Default fallback
  return {
    action: 'flag_for_review',
    status: 'consider',
    message: 'Review recommended.',
    requiresReview: true,
    requiresRetest: false
  };
};

/**
 * Calculate comprehensive integrity assessment
 */
const calculateIntegrityAssessment = async (attemptId, testId, testScore) => {
  try {
    // Get attempt data with latest counts
    const [attempts] = await db.pool.execute(
      `SELECT * FROM test_attempts WHERE id = ?`,
      [attemptId]
    );

    if (attempts.length === 0) {
      throw new Error('Attempt not found');
    }

    const attempt = attempts[0];
    
    // Ensure we're using the latest counts from database
    const tabSwitches = attempt.tab_switch_count || attempt.tab_switches || 0;
    const fullscreenExits = attempt.fullscreen_exit_count || 0;
    
    // Update attempt object with latest counts
    attempt.tab_switch_count = tabSwitches;
    attempt.tab_switches = tabSwitches;
    attempt.fullscreen_exit_count = fullscreenExits;

    // Calculate violation score
    const { riskScore, violations } = calculateViolationScore(attempt);

    // Determine risk level
    const riskLevel = getRiskLevel(riskScore);

    // Analyze time patterns
    const timePatterns = await analyzeTimePatterns(attemptId, testId);

    // Add rapid answering violation if detected
    if (timePatterns.rapidAnswering) {
      violations.rapid_answering = 1;
      const finalRiskScore = riskScore + VIOLATION_WEIGHTS.RAPID_ANSWERING;
      const finalRiskLevel = getRiskLevel(finalRiskScore);

      // Calculate confidence index
      const confidenceIndex = calculateConfidenceIndex(testScore, finalRiskScore);

      // Get recommendation
      const recommendation = getRecommendation(
        testScore,
        finalRiskLevel,
        finalRiskScore,
        timePatterns.flags
      );

      return {
        riskScore: finalRiskScore,
        riskLevel: finalRiskLevel,
        violations: {
          ...violations,
          rapid_answering: 1
        },
        timePatterns,
        confidenceIndex,
        recommendation,
        details: {
          testScore,
          violationBreakdown: violations,
          timeAnalysis: {
            averageTimePerQuestion: timePatterns.averageTimePerQuestion,
            totalTimeSeconds: timePatterns.totalTimeSeconds,
            flags: timePatterns.flags
          }
        }
      };
    }

    // Calculate confidence index
    const confidenceIndex = calculateConfidenceIndex(testScore, riskScore);

    // Get recommendation
    const recommendation = getRecommendation(
      testScore,
      riskLevel,
      riskScore,
      timePatterns.flags
    );

    return {
      riskScore,
      riskLevel,
      violations,
      timePatterns,
      confidenceIndex,
      recommendation,
      details: {
        testScore,
        violationBreakdown: violations,
        timeAnalysis: {
          averageTimePerQuestion: timePatterns.averageTimePerQuestion,
          totalTimeSeconds: timePatterns.totalTimeSeconds,
          flags: timePatterns.flags
        }
      }
    };
  } catch (error) {
    logger.error('Integrity assessment calculation error:', error);
    throw error;
  }
};

/**
 * Format integrity report for HR/Admin
 */
const formatIntegrityReport = (assessment) => {
  const { testScore, riskScore, riskLevel, violations, timePatterns, confidenceIndex, recommendation } = assessment;

  const report = {
    summary: {
      candidateScore: `${testScore}%`,
      integrityRisk: riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1),
      riskScore: riskScore,
      confidenceIndex: `${confidenceIndex.toFixed(1)}%`,
      recommendation: recommendation.message,
      action: recommendation.action
    },
    violations: {
      tabSwitches: violations.tab_switches || 0,
      fullscreenExits: violations.fullscreen_exits || 0,
      copyAttempts: violations.copy_attempts || 0,
      rapidAnswering: violations.rapid_answering || 0,
      multipleLogin: violations.multiple_login || 0
    },
    timeAnalysis: {
      averageTimePerQuestion: timePatterns.averageTimePerQuestion
        ? `${timePatterns.averageTimePerQuestion.toFixed(1)} seconds`
        : 'N/A',
      flags: timePatterns.flags.map(f => f.message)
    },
    recommendation: {
      action: recommendation.action,
      status: recommendation.status,
      message: recommendation.message,
      requiresReview: recommendation.requiresReview,
      requiresRetest: recommendation.requiresRetest,
      reviewReason: recommendation.reviewReason || null
    }
  };

  return report;
};

module.exports = {
  calculateViolationScore,
  getRiskLevel,
  analyzeTimePatterns,
  calculateConfidenceIndex,
  getRecommendation,
  calculateIntegrityAssessment,
  formatIntegrityReport,
  VIOLATION_WEIGHTS,
  RISK_THRESHOLDS,
  RISK_LEVELS
};


