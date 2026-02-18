const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Calculate violation score and risk level
 */
const calculateViolationScore = (attempt) => {
  let violationScore = 0;
  let riskLevel = 'low';

  // Tab switches
  const tabSwitches = attempt.tab_switch_count || 0;
  violationScore += tabSwitches * 2;

  // Fullscreen exits
  const fullscreenExits = attempt.fullscreen_exit_count || 0;
  violationScore += fullscreenExits * 3;

  // Suspicious activity
  const suspiciousActivity = attempt.suspicious_activity 
    ? (typeof attempt.suspicious_activity === 'string' 
        ? JSON.parse(attempt.suspicious_activity) 
        : attempt.suspicious_activity)
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

  return { violationScore, riskLevel };
};

/**
 * Generate trait interpretation based on category scores
 */
const generateTraitInterpretation = (categoryScores) => {
  const interpretations = [];
  const traitDetails = {};

  for (const categoryId in categoryScores) {
    const category = categoryScores[categoryId];
    const percentage = category.percentage || 0;
    let strengthLevel = 'Moderate';
    let interpretation = '';

    if (percentage >= 80) {
      strengthLevel = 'Excellent';
      interpretation = `Candidate demonstrates exceptional ${category.category_name} capabilities with strong performance indicators.`;
    } else if (percentage >= 70) {
      strengthLevel = 'Strong';
      interpretation = `Candidate shows strong ${category.category_name} tendencies and decision-making ability.`;
    } else if (percentage >= 60) {
      strengthLevel = 'Moderate';
      interpretation = `Candidate displays moderate ${category.category_name} with room for development.`;
    } else if (percentage >= 50) {
      strengthLevel = 'Moderate';
      interpretation = `Candidate may struggle with ${category.category_name} in high-pressure situations.`;
    } else {
      strengthLevel = 'Weak';
      interpretation = `Candidate shows limited ${category.category_name} and may require additional support.`;
    }

    interpretations.push({
      category: category.category_name,
      score: percentage,
      strengthLevel,
      interpretation
    });

    traitDetails[category.category_name] = {
      score: percentage,
      strengthLevel,
      interpretation
    };
  }

  return { interpretations, traitDetails };
};

/**
 * Generate behavioral risk indicators
 */
const generateBehavioralRisks = (categoryScores, violationScore) => {
  const risks = [];
  const riskIndicators = {};

  // High Stress Risk
  const emotionalStability = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('emotional') || 
    c.category_name?.toLowerCase().includes('stress')
  );
  if (emotionalStability && emotionalStability.percentage < 50) {
    risks.push({
      type: 'High Stress Risk',
      level: 'high',
      description: 'Candidate may struggle under high-pressure situations based on emotional stability scores.'
    });
    riskIndicators.highStressRisk = true;
  }

  // Overconfidence Risk
  const leadership = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('leadership')
  );
  if (leadership && leadership.percentage > 90) {
    risks.push({
      type: 'Overconfidence Risk',
      level: 'medium',
      description: 'Very high leadership scores may indicate overconfidence or lack of self-awareness.'
    });
    riskIndicators.overconfidenceRisk = true;
  }

  // Impulsiveness Indicator
  const analytical = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('analytical') ||
    c.category_name?.toLowerCase().includes('thinking')
  );
  if (analytical && analytical.percentage < 50) {
    risks.push({
      type: 'Impulsiveness Indicator',
      level: 'medium',
      description: 'Lower analytical thinking scores may suggest impulsive decision-making tendencies.'
    });
    riskIndicators.impulsivenessIndicator = true;
  }

  // Compliance Risk (based on violation score)
  if (violationScore >= 10) {
    risks.push({
      type: 'Compliance Risk',
      level: violationScore >= 20 ? 'high' : 'medium',
      description: `Test integrity violations detected (score: ${violationScore}). Candidate may have integrity concerns.`
    });
    riskIndicators.complianceRisk = true;
  }

  return { risks, riskIndicators };
};

/**
 * Generate work environment fit
 */
const generateWorkEnvironmentFit = (categoryScores) => {
  const fits = [];

  // Structured environments
  const analytical = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('analytical')
  );
  if (analytical && analytical.percentage >= 70) {
    fits.push({
      environment: 'Structured Environments',
      suitability: 'High',
      reason: 'Strong analytical thinking indicates suitability for structured, process-driven environments.'
    });
  }

  // Dynamic startup
  const leadership = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('leadership')
  );
  if (leadership && leadership.percentage >= 70) {
    fits.push({
      environment: 'Dynamic Startup',
      suitability: 'High',
      reason: 'Strong leadership and adaptability scores suggest fit for fast-paced, dynamic environments.'
    });
  }

  // Independent worker
  const independence = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('independent') ||
    c.category_name?.toLowerCase().includes('autonomous')
  );
  if (independence && independence.percentage >= 70) {
    fits.push({
      environment: 'Independent Worker',
      suitability: 'High',
      reason: 'High independence scores indicate ability to work autonomously.'
    });
  }

  // Team-oriented
  const teamwork = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('team') ||
    c.category_name?.toLowerCase().includes('collaboration')
  );
  if (teamwork && teamwork.percentage >= 70) {
    fits.push({
      environment: 'Team-Oriented',
      suitability: 'High',
      reason: 'Strong teamwork and collaboration scores suggest excellent team fit.'
    });
  }

  return fits;
};

/**
 * Generate role suitability
 */
const generateRoleSuitability = (categoryScores) => {
  const roles = [];

  // Sales
  const communication = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('communication') ||
    c.category_name?.toLowerCase().includes('persuasion')
  );
  const leadership = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('leadership')
  );
  if ((communication && communication.percentage >= 70) || 
      (leadership && leadership.percentage >= 70)) {
    roles.push({
      role: 'Sales',
      suitability: 'High',
      score: Math.max(communication?.percentage || 0, leadership?.percentage || 0)
    });
  }

  // Technical
  const analytical = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('analytical') ||
    c.category_name?.toLowerCase().includes('technical')
  );
  if (analytical && analytical.percentage >= 70) {
    roles.push({
      role: 'Technical',
      suitability: 'High',
      score: analytical.percentage
    });
  }

  // Management
  if (leadership && leadership.percentage >= 75) {
    roles.push({
      role: 'Management',
      suitability: 'High',
      score: leadership.percentage
    });
  }

  // Support roles
  const empathy = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('empathy') ||
    c.category_name?.toLowerCase().includes('emotional')
  );
  if (empathy && empathy.percentage >= 70) {
    roles.push({
      role: 'Support Roles',
      suitability: 'High',
      score: empathy.percentage
    });
  }

  return roles;
};

/**
 * Generate interview guidance
 */
const generateInterviewGuidance = (categoryScores, behavioralRisks) => {
  const guidance = [];
  const suggestedQuestions = [];

  // Conflict handling
  const leadership = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('leadership')
  );
  if (leadership && leadership.percentage < 70) {
    guidance.push({
      area: 'Conflict Handling',
      focus: 'Probe candidate\'s experience with conflict resolution and team disagreements.',
      priority: 'high'
    });
    suggestedQuestions.push({
      question: 'Tell me about a time you had to resolve a conflict within your team. How did you approach it?',
      category: 'Leadership'
    });
  }

  // Decision under pressure
  const emotionalStability = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('emotional') ||
    c.category_name?.toLowerCase().includes('stress')
  );
  if (emotionalStability && emotionalStability.percentage < 60) {
    guidance.push({
      area: 'Decision Under Pressure',
      focus: 'Explore how candidate handles high-pressure situations and tight deadlines.',
      priority: 'high'
    });
    suggestedQuestions.push({
      question: 'Describe a situation where you had to make a critical decision under significant time pressure.',
      category: 'Emotional Stability'
    });
  }

  // Emotional regulation
  if (emotionalStability && emotionalStability.percentage < 50) {
    guidance.push({
      area: 'Emotional Regulation',
      focus: 'Assess candidate\'s ability to manage emotions and maintain professionalism.',
      priority: 'high'
    });
    suggestedQuestions.push({
      question: 'How do you manage stress and maintain your composure during challenging situations?',
      category: 'Emotional Stability'
    });
  }

  // Analytical thinking
  const analytical = Object.values(categoryScores).find(c => 
    c.category_name?.toLowerCase().includes('analytical')
  );
  if (analytical && analytical.percentage < 60) {
    guidance.push({
      area: 'Problem-Solving Approach',
      focus: 'Evaluate candidate\'s analytical thinking and structured problem-solving methods.',
      priority: 'medium'
    });
    suggestedQuestions.push({
      question: 'Walk me through your approach to solving a complex problem.',
      category: 'Analytical Thinking'
    });
  }

  return { guidance, suggestedQuestions };
};

/**
 * Generate hiring recommendation
 */
const generateHiringRecommendation = (score, categoryScores, violationScore, riskLevel) => {
  let recommendation = 'consider';
  let reason = '';

  // Check violation score first
  if (violationScore >= 20 || riskLevel === 'high') {
    return {
      recommendation: 'reject',
      reason: 'High integrity risk detected. Multiple test violations indicate potential compliance concerns.'
    };
  }

  // Check overall score
  if (score.percentage_score >= 85 && violationScore < 5) {
    recommendation = 'strong_hire';
    reason = 'Exceptional performance across all categories with minimal integrity concerns.';
  } else if (score.percentage_score >= 70 && violationScore < 10) {
    recommendation = 'consider';
    reason = 'Good overall performance with acceptable risk profile.';
  } else if (score.percentage_score >= 60 && violationScore < 15) {
    recommendation = 'consider';
    reason = 'Moderate performance. Additional evaluation recommended.';
  } else if (score.percentage_score < 50 || violationScore >= 15) {
    recommendation = 'not_recommended';
    reason = 'Below average performance or integrity concerns.';
  }

  return { recommendation, reason };
};

/**
 * Get company average for comparison
 */
const getCompanyAverage = async (testId, companyId) => {
  try {
    const [stats] = await db.pool.execute(
      `SELECT 
        AVG(percentage_score) as avg_score,
        AVG(percentile) as avg_percentile,
        COUNT(*) as total_attempts
       FROM scores
       WHERE test_id = ?`,
      [testId]
    );

    return stats[0] || { avg_score: 0, avg_percentile: 0, total_attempts: 0 };
  } catch (error) {
    logger.error('Error getting company average:', error);
    return { avg_score: 0, avg_percentile: 0, total_attempts: 0 };
  }
};

/**
 * Generate comprehensive report data
 */
const generateComprehensiveReportData = async (attemptId, reportType = 'hr_detailed') => {
  try {
    // Get attempt data
    const [attempts] = await db.pool.execute(
      `SELECT ta.*, t.title as test_title, t.company_id, t.passing_score,
              c.first_name, c.last_name, c.email,
              comp.name as company_name
       FROM test_attempts ta
       JOIN tests t ON ta.test_id = t.id
       JOIN candidates c ON ta.candidate_id = c.id
       JOIN companies comp ON t.company_id = comp.id
       WHERE ta.id = ?`,
      [attemptId]
    );

    if (attempts.length === 0) {
      throw new Error('Attempt not found');
    }

    const attempt = attempts[0];

    // Get score
    const [scores] = await db.pool.execute(
      'SELECT * FROM scores WHERE attempt_id = ?',
      [attemptId]
    );

    if (scores.length === 0) {
      throw new Error('Score not found');
    }

    const score = scores[0];
    const categoryScores = typeof score.category_scores === 'string' 
      ? JSON.parse(score.category_scores) 
      : score.category_scores;

    // Calculate violation score
    const { violationScore, riskLevel } = calculateViolationScore(attempt);

    // Get attempt number
    const [attemptCount] = await db.pool.execute(
      `SELECT COUNT(*) as count FROM test_attempts 
       WHERE test_id = ? AND candidate_id = ? AND id <= ?`,
      [attempt.test_id, attempt.candidate_id, attemptId]
    );
    const attemptNumber = attemptCount[0]?.count || 1;

    // Generate all sections
    const traitData = generateTraitInterpretation(categoryScores);
    const behavioralRisks = generateBehavioralRisks(categoryScores, violationScore);
    const workEnvironmentFit = generateWorkEnvironmentFit(categoryScores);
    const roleSuitability = generateRoleSuitability(categoryScores);
    const interviewGuidance = generateInterviewGuidance(categoryScores, behavioralRisks);
    const hiringRecommendation = generateHiringRecommendation(
      score, 
      categoryScores, 
      violationScore, 
      riskLevel
    );

    // Get company average
    const companyAverage = await getCompanyAverage(attempt.test_id, attempt.company_id);

    // Get benchmark comparison
    const [benchmarks] = await db.pool.execute(
      `SELECT * FROM benchmarks WHERE test_id = ? OR test_id IS NULL`,
      [attempt.test_id]
    );

    // Category ranking
    const categoryRanking = Object.values(categoryScores)
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .map((cat, index) => ({
        rank: index + 1,
        category: cat.category_name,
        score: cat.percentage
      }));

    // Build report data
    const reportData = {
      attempt_id: attemptId,
      test_id: attempt.test_id,
      candidate_id: attempt.candidate_id,
      company_id: attempt.company_id,
      report_type: reportType,
      
      // Section 1: Candidate Overview
      candidate_name: `${attempt.first_name} ${attempt.last_name}`,
      test_name: attempt.test_title,
      test_date: attempt.submitted_at || attempt.started_at,
      duration_taken_seconds: attempt.time_taken_seconds || 0,
      attempt_number: attemptNumber,
      violation_score: violationScore,
      percentile_rank: score.percentile || 0,
      
      // Section 2: Overall Performance
      total_score: score.total_score,
      percentile_ranking: score.percentile || 0,
      pass_fail_status: score.passed ? 'pass' : 'fail',
      benchmark_comparison: benchmarks,
      company_average_comparison: {
        candidate_score: score.percentage_score,
        company_average: companyAverage.avg_score,
        difference: score.percentage_score - (companyAverage.avg_score || 0),
        percentile: score.percentile || 0,
        company_percentile: companyAverage.avg_percentile || 0
      },
      
      // Section 3: Category-wise Analysis
      category_scores: categoryScores,
      category_ranking: categoryRanking,
      
      // Section 4: Trait Interpretation
      trait_interpretation: traitData.interpretations.map(t => t.interpretation).join(' '),
      trait_details: traitData.traitDetails,
      
      // Section 5: Behavioral Risk Indicators
      behavioral_risks: behavioralRisks.risks,
      risk_indicators: behavioralRisks.riskIndicators,
      
      // Section 6: Work Environment Fit
      work_environment_fit: workEnvironmentFit,
      
      // Section 7: Role Suitability
      role_suitability: roleSuitability,
      
      // Section 8: Interview Guidance
      interview_guidance: interviewGuidance.guidance,
      suggested_questions: interviewGuidance.suggestedQuestions,
      
      // Section 9: Cheating / Integrity Summary
      total_violations: violationScore,
      tab_switch_count: attempt.tab_switch_count || 0,
      fullscreen_exit_count: attempt.fullscreen_exit_count || 0,
      suspicion_risk_level: riskLevel,
      integrity_summary: `Violation Score: ${violationScore}. Risk Level: ${riskLevel.toUpperCase()}. ${violationScore === 0 ? 'No violations detected.' : `${attempt.tab_switch_count || 0} tab switches, ${attempt.fullscreen_exit_count || 0} fullscreen exits detected.`}`,
      
      // Additional
      hiring_recommendation: hiringRecommendation.recommendation,
      recommendation_reason: hiringRecommendation.reason,
      company_name: attempt.company_name || 'Nirmatra Training Solutions'
    };

    // Save to database (optional - don't fail if table doesn't exist)
    try {
      await db.pool.execute(
        `INSERT INTO comprehensive_reports 
         (attempt_id, test_id, candidate_id, company_id, report_type,
          candidate_name, test_name, test_date, duration_taken_seconds, attempt_number,
          violation_score, percentile_rank, total_score, percentile_ranking, pass_fail_status,
          benchmark_comparison, company_average_comparison, category_scores, category_ranking,
          trait_interpretation, trait_details, behavioral_risks, risk_indicators,
          work_environment_fit, role_suitability, interview_guidance, suggested_questions,
          total_violations, tab_switch_count, fullscreen_exit_count, suspicion_risk_level,
          integrity_summary, hiring_recommendation, recommendation_reason, company_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          candidate_name = VALUES(candidate_name),
          test_name = VALUES(test_name),
          test_date = VALUES(test_date),
          duration_taken_seconds = VALUES(duration_taken_seconds),
          attempt_number = VALUES(attempt_number),
          violation_score = VALUES(violation_score),
          percentile_rank = VALUES(percentile_rank),
          total_score = VALUES(total_score),
          percentile_ranking = VALUES(percentile_ranking),
          pass_fail_status = VALUES(pass_fail_status),
          benchmark_comparison = VALUES(benchmark_comparison),
          company_average_comparison = VALUES(company_average_comparison),
          category_scores = VALUES(category_scores),
          category_ranking = VALUES(category_ranking),
          trait_interpretation = VALUES(trait_interpretation),
          trait_details = VALUES(trait_details),
          behavioral_risks = VALUES(behavioral_risks),
          risk_indicators = VALUES(risk_indicators),
          work_environment_fit = VALUES(work_environment_fit),
          role_suitability = VALUES(role_suitability),
          interview_guidance = VALUES(interview_guidance),
          suggested_questions = VALUES(suggested_questions),
          total_violations = VALUES(total_violations),
          tab_switch_count = VALUES(tab_switch_count),
          fullscreen_exit_count = VALUES(fullscreen_exit_count),
          suspicion_risk_level = VALUES(suspicion_risk_level),
          integrity_summary = VALUES(integrity_summary),
          hiring_recommendation = VALUES(hiring_recommendation),
          recommendation_reason = VALUES(recommendation_reason),
          company_name = VALUES(company_name),
          updated_at = CURRENT_TIMESTAMP`,
      [
        reportData.attempt_id, reportData.test_id, reportData.candidate_id, reportData.company_id, reportData.report_type,
        reportData.candidate_name, reportData.test_name, reportData.test_date, reportData.duration_taken_seconds, reportData.attempt_number,
        reportData.violation_score, reportData.percentile_rank, reportData.total_score, reportData.percentile_ranking, reportData.pass_fail_status,
        JSON.stringify(reportData.benchmark_comparison), JSON.stringify(reportData.company_average_comparison), 
        JSON.stringify(reportData.category_scores), JSON.stringify(reportData.category_ranking),
        reportData.trait_interpretation, JSON.stringify(reportData.trait_details), 
        JSON.stringify(reportData.behavioral_risks), JSON.stringify(reportData.risk_indicators),
        JSON.stringify(reportData.work_environment_fit), JSON.stringify(reportData.role_suitability),
        JSON.stringify(reportData.interview_guidance), JSON.stringify(reportData.suggested_questions),
        reportData.total_violations, reportData.tab_switch_count, reportData.fullscreen_exit_count, reportData.suspicion_risk_level,
        reportData.integrity_summary, reportData.hiring_recommendation, reportData.recommendation_reason, reportData.company_name
      ]
      );
      logger.info(`Report saved to comprehensive_reports for attempt ${reportData.attempt_id}`);
    } catch (saveError) {
      // If table doesn't exist or save fails, log warning but continue
      logger.warn(`Failed to save report to database (table may not exist): ${saveError.message}`);
      // Report will still be returned even if save fails
    }

    return reportData;
  } catch (error) {
    logger.error('Error generating comprehensive report data:', error);
    throw error;
  }
};

/**
 * Get HR Detailed Report
 */
const getHRDetailedReport = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Company ID not found. Please login again.'
      });
    }

    // First verify the attempt exists and belongs to the company
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
        message: 'Test attempt not found or you do not have access to it'
      });
    }

    // Check if report exists in comprehensive_reports table
    let reportData;
    try {
      const [existingReports] = await db.pool.execute(
        `SELECT * FROM comprehensive_reports 
         WHERE attempt_id = ? AND report_type = 'hr_detailed' AND company_id = ?`,
        [attempt_id, companyId]
      );

      if (existingReports.length > 0) {
        // Parse JSON fields
        const report = existingReports[0];
        reportData = {
          ...report,
          benchmark_comparison: typeof report.benchmark_comparison === 'string' 
            ? JSON.parse(report.benchmark_comparison) 
            : report.benchmark_comparison,
          company_average_comparison: typeof report.company_average_comparison === 'string' 
            ? JSON.parse(report.company_average_comparison) 
            : report.company_average_comparison,
          category_scores: typeof report.category_scores === 'string' 
            ? JSON.parse(report.category_scores) 
            : report.category_scores,
          category_ranking: typeof report.category_ranking === 'string' 
            ? JSON.parse(report.category_ranking) 
            : report.category_ranking,
          trait_details: typeof report.trait_details === 'string' 
            ? JSON.parse(report.trait_details) 
            : report.trait_details,
          behavioral_risks: typeof report.behavioral_risks === 'string' 
            ? JSON.parse(report.behavioral_risks) 
            : report.behavioral_risks,
          risk_indicators: typeof report.risk_indicators === 'string' 
            ? JSON.parse(report.risk_indicators) 
            : report.risk_indicators,
          work_environment_fit: typeof report.work_environment_fit === 'string' 
            ? JSON.parse(report.work_environment_fit) 
            : report.work_environment_fit,
          role_suitability: typeof report.role_suitability === 'string' 
            ? JSON.parse(report.role_suitability) 
            : report.role_suitability,
          interview_guidance: typeof report.interview_guidance === 'string' 
            ? JSON.parse(report.interview_guidance) 
            : report.interview_guidance,
          suggested_questions: typeof report.suggested_questions === 'string' 
            ? JSON.parse(report.suggested_questions) 
            : report.suggested_questions
        };
      } else {
        // Generate new report on-the-fly
        logger.info(`Generating HR detailed report for attempt ${attempt_id}`);
        reportData = await generateComprehensiveReportData(attempt_id, 'hr_detailed');
      }
    } catch (tableError) {
      // If comprehensive_reports table doesn't exist, generate report on-the-fly
      logger.warn(`comprehensive_reports table may not exist, generating report on-the-fly: ${tableError.message}`);
      reportData = await generateComprehensiveReportData(attempt_id, 'hr_detailed');
    }

    if (!reportData) {
      return res.status(404).json({
        success: false,
        message: 'Failed to generate report data'
      });
    }

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    logger.error('Get HR Detailed Report error:', error);
    console.error('Full error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating HR detailed report',
      error: error.message
    });
  }
};

/**
 * Get Candidate Summary Report (Simplified)
 */
const getCandidateSummaryReport = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user?.company_id || req.candidate?.company_id;

    // Generate or get report
    let reportData;
    const [existingReports] = await db.pool.execute(
      `SELECT * FROM comprehensive_reports 
       WHERE attempt_id = ? AND report_type = 'candidate_summary' AND company_id = ?`,
      [attempt_id, companyId]
    );

    if (existingReports.length > 0) {
      const report = existingReports[0];
      reportData = {
        candidate_name: report.candidate_name,
        test_name: report.test_name,
        test_date: report.test_date,
        total_score: report.total_score,
        percentile_ranking: report.percentile_ranking,
        category_scores: typeof report.category_scores === 'string' 
          ? JSON.parse(report.category_scores) 
          : report.category_scores,
        category_ranking: typeof report.category_ranking === 'string' 
          ? JSON.parse(report.category_ranking) 
          : report.category_ranking,
        trait_details: typeof report.trait_details === 'string' 
          ? JSON.parse(report.trait_details) 
          : report.trait_details,
        // Only show strengths (high scores)
        strengths: Object.values(typeof report.category_scores === 'string' 
          ? JSON.parse(report.category_scores) 
          : report.category_scores)
          .filter(cat => (cat.percentage || 0) >= 70)
          .map(cat => cat.category_name),
        // Only show development areas (low scores)
        development_areas: Object.values(typeof report.category_scores === 'string' 
          ? JSON.parse(report.category_scores) 
          : report.category_scores)
          .filter(cat => (cat.percentage || 0) < 60)
          .map(cat => cat.category_name)
      };
    } else {
      // Generate full report first, then simplify
      const fullReport = await generateComprehensiveReportData(attempt_id, 'candidate_summary');
      reportData = {
        candidate_name: fullReport.candidate_name,
        test_name: fullReport.test_name,
        test_date: fullReport.test_date,
        total_score: fullReport.total_score,
        percentile_ranking: fullReport.percentile_ranking,
        category_scores: fullReport.category_scores,
        category_ranking: fullReport.category_ranking,
        trait_details: fullReport.trait_details,
        strengths: Object.values(fullReport.category_scores)
          .filter(cat => (cat.percentage || 0) >= 70)
          .map(cat => cat.category_name),
        development_areas: Object.values(fullReport.category_scores)
          .filter(cat => (cat.percentage || 0) < 60)
          .map(cat => cat.category_name)
      };
    }

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    logger.error('Get Candidate Summary Report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating candidate summary report',
      error: error.message
    });
  }
};

/**
 * Get Comparative Report (For HR - Multiple Candidates)
 */
const getComparativeReport = async (req, res) => {
  try {
    const { test_id } = req.params;
    const companyId = req.companyId || req.user?.company_id;

    // Get all completed attempts for this test
    const [attempts] = await db.pool.execute(
      `SELECT ta.id as attempt_id, ta.candidate_id, ta.submitted_at,
              c.first_name, c.last_name, c.email,
              s.percentage_score, s.percentile, s.passed
       FROM test_attempts ta
       JOIN candidates c ON ta.candidate_id = c.id
       JOIN scores s ON ta.id = s.attempt_id
       JOIN tests t ON ta.test_id = t.id
       WHERE ta.test_id = ? AND t.company_id = ? AND ta.status = 'completed'
       ORDER BY s.percentage_score DESC`,
      [test_id, companyId]
    );

    const comparativeData = [];

    for (const attempt of attempts) {
      // Get or generate report for each candidate
      const [reports] = await db.pool.execute(
        `SELECT * FROM comprehensive_reports 
         WHERE attempt_id = ? AND report_type = 'hr_detailed'`,
        [attempt.attempt_id]
      );

      let report;
      if (reports.length > 0) {
        report = reports[0];
      } else {
        // Generate report
        report = await generateComprehensiveReportData(attempt.attempt_id, 'hr_detailed');
      }

      comparativeData.push({
        candidate_name: `${attempt.first_name} ${attempt.last_name}`,
        candidate_email: attempt.email,
        attempt_id: attempt.attempt_id,
        total_score: report.total_score || attempt.percentage_score,
        percentile: report.percentile_ranking || attempt.percentile,
        risk_level: report.suspicion_risk_level || 'low',
        violation_score: report.violation_score || 0,
        recommendation: report.hiring_recommendation || 'consider',
        recommendation_reason: report.recommendation_reason || '',
        passed: attempt.passed
      });
    }

    res.json({
      success: true,
      data: {
        test_id: parseInt(test_id),
        candidates: comparativeData,
        total_candidates: comparativeData.length,
        average_score: comparativeData.length > 0
          ? comparativeData.reduce((sum, c) => sum + (c.total_score || 0), 0) / comparativeData.length
          : 0
      }
    });
  } catch (error) {
    logger.error('Get Comparative Report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating comparative report',
      error: error.message
    });
  }
};

module.exports = {
  generateComprehensiveReportData,
  getHRDetailedReport,
  getCandidateSummaryReport,
  getComparativeReport
};

