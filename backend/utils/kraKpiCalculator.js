const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Automatically calculate and store KRA/KPI performance from test results
 * This is called when a test is completed
 */
const calculateAndStoreKRAKPIPerformance = async (attemptId, testId, candidateId, companyId) => {
  try {
    logger.info(`Starting KRA/KPI calculation for attempt ${attemptId}, test ${testId}, candidate ${candidateId}, company ${companyId}`);
    
    // Get test attempt details
    const [attempts] = await db.pool.execute(
      'SELECT * FROM test_attempts WHERE id = ?',
      [attemptId]
    );

    if (attempts.length === 0) {
      logger.warn(`Attempt ${attemptId} not found for KRA/KPI calculation`);
      return;
    }

    const attempt = attempts[0];
    const submittedAt = attempt.submitted_at || new Date();

    // Get test category scores from the scores table
    const [scores] = await db.pool.execute(
      'SELECT category_scores, percentage_score FROM scores WHERE attempt_id = ?',
      [attemptId]
    );

    if (scores.length === 0) {
      logger.warn(`No scores found for attempt ${attemptId}. Scores may not be calculated yet.`);
      return;
    }

    const scoreData = scores[0];
    let categoryScores = {};
    
    try {
      categoryScores = typeof scoreData.category_scores === 'string' 
        ? JSON.parse(scoreData.category_scores) 
        : scoreData.category_scores || {};
      
      if (!categoryScores || Object.keys(categoryScores).length === 0) {
        logger.warn(`No category scores found in attempt ${attemptId}`);
        return;
      }
      
      logger.info(`Found ${Object.keys(categoryScores).length} category scores for attempt ${attemptId}`);
    } catch (parseError) {
      logger.error(`Error parsing category_scores for attempt ${attemptId}:`, parseError);
      return;
    }

    // Get candidate's assigned KRAs
    // First, try to get KRAs assigned directly to the candidate
    let [assignedKRAs] = await db.pool.execute(
      `SELECT ek.*, k.title as kra_title, k.role_name, k.evaluation_period, k.weight as kra_weight
       FROM employee_kras ek
       JOIN kras k ON ek.kra_id = k.id
       WHERE ek.employee_type = 'candidate' 
         AND ek.employee_id = ? 
         AND ek.company_id = ?
         AND ek.status = 'active'`,
      [candidateId, companyId]
    );

    // If no KRAs assigned directly, try to get KRAs based on candidate's role or test
    if (assignedKRAs.length === 0) {
      logger.info(`No KRAs directly assigned to candidate ${candidateId}, checking for role-based KRAs`);
      
      // Try to get candidate's role from test assignment or candidate profile
      // First check if there's a test assignment with role info
      const [testInfo] = await db.pool.execute(
        `SELECT t.role_name, ta.role 
         FROM test_attempts ta
         JOIN tests t ON ta.test_id = t.id
         WHERE ta.id = ?`,
        [attemptId]
      );
      
      let roleName = null;
      if (testInfo.length > 0 && testInfo[0].role_name) {
        roleName = testInfo[0].role_name;
      } else if (testInfo.length > 0 && testInfo[0].role) {
        roleName = testInfo[0].role;
      } else {
        // Try to get from candidate profile (if role column exists)
        try {
          const [candidateInfo] = await db.pool.execute(
            'SELECT role, position FROM candidates WHERE id = ?',
            [candidateId]
          );
          
          if (candidateInfo.length > 0) {
            roleName = candidateInfo[0].role || candidateInfo[0].position;
          }
        } catch (error) {
          // Role column might not exist, that's okay
          logger.debug('Role column not found in candidates table, skipping role-based KRA lookup');
        }
      }
      
      if (roleName) {
        // Get KRAs for the candidate's role
        [assignedKRAs] = await db.pool.execute(
          `SELECT k.id as kra_id, k.title as kra_title, k.role_name, k.evaluation_period, k.weight as kra_weight,
                  k.company_id, k.status, 'candidate' as employee_type, ? as employee_id
           FROM kras k
           WHERE k.role_name = ? 
             AND k.company_id = ?
             AND k.status = 'active'`,
          [candidateId, roleName, companyId]
        );
        
        logger.info(`Found ${assignedKRAs.length} role-based KRAs for candidate ${candidateId} with role "${roleName}"`);
      } else {
        logger.debug(`No role found for candidate ${candidateId}, cannot lookup role-based KRAs`);
      }
    }

    if (assignedKRAs.length === 0) {
      logger.info(`No KRAs found for candidate ${candidateId} (neither assigned nor role-based), skipping KRA/KPI calculation`);
      logger.info(`To enable KRA/KPI calculation, please assign KRAs to the candidate or ensure the candidate has a role that matches KRA role_name`);
      return;
    }
    
    logger.info(`Found ${assignedKRAs.length} KRAs for candidate ${candidateId}`);

    // Get all test categories for the company (for mapping)
    const [allTestCategories] = await db.pool.execute(
      `SELECT id, name FROM test_categories WHERE company_id = ?`,
      [companyId]
    );
    
    // Get test categories for this specific test (if mapping table exists)
    let testCategories = [];
    try {
      const [categories] = await db.pool.execute(
        `SELECT tc.id, tc.name, tcm.weight
         FROM test_categories_mapping tcm
         JOIN test_categories tc ON tcm.category_id = tc.id
         WHERE tcm.test_id = ?`,
        [testId]
      );
      testCategories = categories;
    } catch (error) {
      // Table might not exist, use all categories
      logger.debug('test_categories_mapping table not found, using all categories');
      testCategories = allTestCategories;
    }

    // Create a mapping: test category name -> category score
    const categoryScoreMap = {};
    Object.values(categoryScores).forEach(cat => {
      if (cat.category_name) {
        categoryScoreMap[cat.category_name.toLowerCase().trim()] = cat;
      }
    });

    // Process each assigned KRA
    for (const assignedKRA of assignedKRAs) {
      const kraId = assignedKRA.kra_id;
      const evaluationPeriod = assignedKRA.evaluation_period || 'quarterly';
      
      // Calculate period dates based on evaluation period
      const periodDates = calculatePeriodDates(submittedAt, evaluationPeriod);
      
      // Get KPIs for this KRA (including test_category_id)
      const [kpis] = await db.pool.execute(
        `SELECT kp.*, tc.name as test_category_name
         FROM kpis kp
         LEFT JOIN test_categories tc ON kp.test_category_id = tc.id
         WHERE kp.kra_id = ? AND kp.company_id = ? AND kp.status = 'active'`,
        [kraId, companyId]
      );

      if (kpis.length === 0) {
        logger.info(`No KPIs found for KRA ${kraId}, skipping`);
        continue;
      }

      // Calculate KRA performance based on test category scores
      // Try to match test categories to KRA (by name similarity or mapping)
      let kraScore = 0;
      let totalKPIWeight = 0;
      let completedKPIs = 0;

      // Process each KPI
      for (const kpi of kpis) {
        try {
          let matchingCategory = null;
          
          // First, check if KPI has explicit test_category_id mapping
          if (kpi.test_category_id) {
            const categoryId = kpi.test_category_id;
            
            // Find the test category by ID
            const testCat = allTestCategories.find(tc => tc.id === categoryId);
            
            if (testCat) {
              // Match by category name (case-insensitive)
              const catNameLower = testCat.name.toLowerCase().trim();
              matchingCategory = categoryScoreMap[catNameLower];
              
              if (matchingCategory) {
                logger.info(`Using explicit mapping: KPI "${kpi.title}" -> Category "${testCat.name}" (ID: ${categoryId})`);
              } else {
                logger.warn(`Explicit mapping found for KPI "${kpi.title}" to category "${testCat.name}" (ID: ${categoryId}), but category score not found in test results`);
              }
            } else {
              logger.warn(`KPI "${kpi.title}" has test_category_id ${categoryId}, but category not found`);
            }
          }
          
          // If no explicit mapping, fall back to fuzzy matching
          if (!matchingCategory) {
            logger.info(`No explicit mapping for KPI ${kpi.id} (${kpi.title}), trying fuzzy name matching...`);
            logger.info(`Available categories in test: ${Object.keys(categoryScoreMap).join(', ')}`);
            matchingCategory = findMatchingCategory(kpi, testCategories, categoryScoreMap);
            
            if (matchingCategory) {
              logger.info(`Fuzzy match found: KPI "${kpi.title}" -> Category "${matchingCategory.category_name}"`);
            } else {
              logger.warn(`No match found for KPI "${kpi.title}". Please map it to a test category in KPI settings.`);
            }
          }
          
          if (matchingCategory && matchingCategory.percentage !== undefined) {
            const percentage = parseFloat(matchingCategory.percentage) || 0;
            
            // Calculate KPI performance
            const targetValue = parseFloat(kpi.target_value) || 100;
            const actualValue = percentage; // Use test category percentage as actual value
            const achievementPercentage = targetValue > 0 
              ? Math.min(100, (actualValue / targetValue) * 100) 
              : 0;

            // Determine rating
            const rating = calculateRating(achievementPercentage);

            logger.info(`Calculating KPI ${kpi.id} (${kpi.title}): actual=${actualValue}%, target=${targetValue}%, achievement=${achievementPercentage.toFixed(2)}%`);

            // Store or update KPI performance
            await storeKPIPerformance({
              companyId,
              employeeType: 'candidate',
              employeeId: candidateId,
              kpiId: kpi.id,
              kraId: kraId,
              periodStart: periodDates.start,
              periodEnd: periodDates.end,
              targetValue: targetValue,
              actualValue: actualValue,
              achievementPercentage: achievementPercentage,
              rating: rating,
              status: 'approved', // Auto-approve test-based performance
              comments: `Auto-calculated from test completion. Test: ${testId}, Attempt: ${attemptId}, Category: ${matchingCategory.category_name || 'N/A'}`,
              submittedBy: null // System-generated
            });

            // Accumulate for KRA score
            const kpiWeight = parseFloat(kpi.weight) || 1.0;
            kraScore += (achievementPercentage / 100) * kpiWeight;
            totalKPIWeight += kpiWeight;
            completedKPIs++;
            
            logger.info(`KPI ${kpi.id} performance stored successfully`);
          } else {
            if (kpi.test_category_id) {
              logger.warn(`KPI ${kpi.id} (${kpi.title}) has test_category_id ${kpi.test_category_id} but no matching category score found. Available categories: ${Object.keys(categoryScoreMap).join(', ')}`);
            } else {
              logger.warn(`KPI ${kpi.id} (${kpi.title}) has no test_category_id mapping and fuzzy matching failed. Available categories: ${Object.keys(categoryScoreMap).join(', ')}. Please map this KPI to a test category in KPI settings.`);
            }
          }
        } catch (kpiError) {
          logger.error(`Error processing KPI ${kpi.id} (${kpi.title}):`, kpiError);
          // Continue with next KPI instead of failing entire process
        }
      }

      // Calculate overall KRA score
      const overallKRAScore = totalKPIWeight > 0 
        ? (kraScore / totalKPIWeight) * 100 
        : 0;

      const kraRating = calculateRating(overallKRAScore);

      logger.info(`KRA ${kraId} (${assignedKRA.kra_title}) summary: ${completedKPIs}/${kpis.length} KPIs completed, overall score: ${overallKRAScore.toFixed(2)}%`);

      // Store or update KRA performance summary (even if no KPIs matched, to track the attempt)
      try {
        await storeKRAPerformanceSummary({
          companyId,
          employeeType: 'candidate',
          employeeId: candidateId,
          kraId: kraId,
          periodStart: periodDates.start,
          periodEnd: periodDates.end,
          totalKPIs: kpis.length,
          completedKPIs: completedKPIs,
          overallScore: overallKRAScore,
          weightedScore: overallKRAScore * (parseFloat(assignedKRA.kra_weight) || 1.0) / 100,
          rating: kraRating,
          status: 'approved',
          reviewComments: `Auto-calculated from test completion. Test: ${testId}, Attempt: ${attemptId}. ${completedKPIs} of ${kpis.length} KPIs matched with test categories.`,
          submittedBy: null
        });

        logger.info(`KRA ${kraId} performance summary stored successfully`);
      } catch (kraError) {
        logger.error(`Error storing KRA ${kraId} performance summary:`, kraError);
        // Continue with next KRA instead of failing entire process
      }
    }

    logger.info(`KRA/KPI performance calculation completed successfully for attempt ${attemptId}`);
  } catch (error) {
    logger.error(`Error calculating KRA/KPI performance for attempt ${attemptId}:`, error);
    logger.error(`Error stack:`, error.stack);
    // Don't throw - this is a background process, but log the error for debugging
    console.error('KRA/KPI Calculation Error Details:', {
      attemptId,
      testId,
      candidateId,
      companyId,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Calculate period dates based on evaluation period
 */
const calculatePeriodDates = (date, period) => {
  const d = new Date(date);
  let start, end;

  switch (period) {
    case 'monthly':
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      break;
    case 'quarterly':
      const quarter = Math.floor(d.getMonth() / 3);
      start = new Date(d.getFullYear(), quarter * 3, 1);
      end = new Date(d.getFullYear(), (quarter + 1) * 3, 0);
      break;
    case 'half_yearly':
      const half = Math.floor(d.getMonth() / 6);
      start = new Date(d.getFullYear(), half * 6, 1);
      end = new Date(d.getFullYear(), (half + 1) * 6, 0);
      break;
    case 'yearly':
      start = new Date(d.getFullYear(), 0, 1);
      end = new Date(d.getFullYear(), 11, 31);
      break;
    default:
      // Default to current month
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

/**
 * Find matching test category for a KPI
 * Enhanced matching logic with multiple strategies
 */
const findMatchingCategory = (kpi, testCategories, categoryScoreMap) => {
  const kpiTitleLower = (kpi.title || '').toLowerCase().trim();
  const kpiTitleWords = kpiTitleLower.split(/\s+/).filter(w => w.length > 2); // Filter out short words
  
  logger.debug(`Trying to match KPI "${kpi.title}" (lowercase: "${kpiTitleLower}") with available categories: ${Object.keys(categoryScoreMap).join(', ')}`);
  
  // Strategy 1: Exact match
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    if (categoryName === kpiTitleLower) {
      logger.info(`✓ Exact match found: KPI "${kpi.title}" -> Category "${scoreData.category_name}"`);
      return scoreData;
    }
  }

  // Strategy 2: Contains match (either direction) - more lenient
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    if (categoryName.includes(kpiTitleLower) || kpiTitleLower.includes(categoryName)) {
      logger.info(`✓ Contains match found: KPI "${kpi.title}" -> Category "${scoreData.category_name}"`);
      return scoreData;
    }
  }

  // Strategy 3: Word-based matching (check if significant words match)
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    const categoryWords = categoryName.split(/\s+/).filter(w => w.length > 2);
    const commonWords = kpiTitleWords.filter(w => categoryWords.includes(w));
    
    if (commonWords.length > 0 && commonWords.length >= Math.min(kpiTitleWords.length, categoryWords.length) * 0.5) {
      logger.info(`✓ Word-based match found: KPI "${kpi.title}" -> Category "${scoreData.category_name}" (common words: ${commonWords.join(', ')})`);
      return scoreData;
    }
  }

  // Strategy 4: Try matching with test categories table (if available)
  for (const testCat of testCategories) {
    const testCatName = (testCat.name || '').toLowerCase().trim();
    if (testCatName === kpiTitleLower || 
        testCatName.includes(kpiTitleLower) || 
        kpiTitleLower.includes(testCatName)) {
      const matchedScore = categoryScoreMap[testCatName];
      if (matchedScore) {
        logger.info(`✓ Test category match found: KPI "${kpi.title}" -> Category "${matchedScore.category_name}"`);
        return matchedScore;
      }
    }
  }

  // Strategy 5: Fuzzy matching - check for similar keywords (expanded list)
  const commonKeywords = [
    'leadership', 'communication', 'analytical', 'analytics', 'emotional', 'stability', 
    'thinking', 'problem', 'solving', 'team', 'work', 'performance', 
    'quality', 'delivery', 'bug', 'security', 'collaboration', 'code',
    'maintainability', 'feature', 'resolution', 'optimization', 'compliance'
  ];
  
  for (const keyword of commonKeywords) {
    if (kpiTitleLower.includes(keyword)) {
      for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
        if (categoryName.includes(keyword)) {
          logger.info(`✓ Keyword match found: KPI "${kpi.title}" -> Category "${scoreData.category_name}" (keyword: ${keyword})`);
          return scoreData;
        }
      }
    }
  }

  // Strategy 6: Check if KPI title is a substring of category name or vice versa
  // This handles cases like "Analytical" matching "Analytical Thinking"
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    // If KPI title is shorter, check if it's contained in category name
    if (kpiTitleLower.length < categoryName.length) {
      if (categoryName.includes(kpiTitleLower)) {
        logger.info(`✓ Substring match found: KPI "${kpi.title}" -> Category "${scoreData.category_name}" (KPI is substring of category)`);
        return scoreData;
      }
    }
    // If category name is shorter, check if it's contained in KPI title
    if (categoryName.length < kpiTitleLower.length) {
      if (kpiTitleLower.includes(categoryName)) {
        logger.info(`✓ Substring match found: KPI "${kpi.title}" -> Category "${scoreData.category_name}" (category is substring of KPI)`);
        return scoreData;
      }
    }
  }

  // Strategy 6: Partial word matching (e.g., "Analytical" matches "Analytical Thinking")
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    const categoryWords = categoryName.split(/\s+/);
    const kpiWords = kpiTitleLower.split(/\s+/);
    
    // Check if any significant word from KPI appears in category name
    for (const kpiWord of kpiWords) {
      if (kpiWord.length > 3) { // Only check words longer than 3 characters
        for (const catWord of categoryWords) {
          if (catWord.toLowerCase().includes(kpiWord) || kpiWord.includes(catWord.toLowerCase())) {
            logger.info(`✓ Partial word match found: KPI "${kpi.title}" -> Category "${scoreData.category_name}" (word: ${kpiWord})`);
            return scoreData;
          }
        }
      }
    }
  }

  // If no match found, return null (KPI won't be calculated from this test)
  logger.warn(`✗ No match found for KPI "${kpi.title}". Available categories: ${Object.keys(categoryScoreMap).join(', ')}`);
  return null;
};

/**
 * Calculate rating based on achievement percentage
 */
const calculateRating = (percentage) => {
  if (percentage >= 90) return 'excellent';
  if (percentage >= 75) return 'good';
  if (percentage >= 60) return 'satisfactory';
  if (percentage >= 40) return 'needs_improvement';
  return 'poor';
};

/**
 * Store or update KPI performance
 */
const storeKPIPerformance = async (data) => {
  try {
    // Check if performance record already exists
    const [existing] = await db.pool.execute(
      `SELECT id FROM kpi_performance 
       WHERE employee_type = ? AND employee_id = ? AND kpi_id = ? 
         AND period_start = ? AND period_end = ?`,
      [data.employeeType, data.employeeId, data.kpiId, data.periodStart, data.periodEnd]
    );

    if (existing.length > 0) {
      // Update existing record
      await db.pool.execute(
        `UPDATE kpi_performance SET
         target_value = ?, actual_value = ?, achievement_percentage = ?,
         rating = ?, status = ?, comments = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.targetValue,
          data.actualValue,
          data.achievementPercentage,
          data.rating,
          data.status,
          data.comments,
          existing[0].id
        ]
      );
    } else {
      // Insert new record
      await db.pool.execute(
        `INSERT INTO kpi_performance 
         (company_id, employee_type, employee_id, kpi_id, kra_id, 
          period_start, period_end, target_value, actual_value, 
          achievement_percentage, rating, status, comments, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          data.companyId,
          data.employeeType,
          data.employeeId,
          data.kpiId,
          data.kraId,
          data.periodStart,
          data.periodEnd,
          data.targetValue,
          data.actualValue,
          data.achievementPercentage,
          data.rating,
          data.status,
          data.comments
        ]
      );
    }
  } catch (error) {
    logger.error('Error storing KPI performance:', error);
    throw error;
  }
};

/**
 * Store or update KRA performance summary
 */
const storeKRAPerformanceSummary = async (data) => {
  try {
    // Check if summary already exists
    const [existing] = await db.pool.execute(
      `SELECT id FROM kra_performance_summary 
       WHERE employee_type = ? AND employee_id = ? AND kra_id = ? 
         AND period_start = ? AND period_end = ?`,
      [data.employeeType, data.employeeId, data.kraId, data.periodStart, data.periodEnd]
    );

    if (existing.length > 0) {
      // Update existing record
      await db.pool.execute(
        `UPDATE kra_performance_summary SET
         total_kpis = ?, completed_kpis = ?, overall_score = ?,
         weighted_score = ?, rating = ?, status = ?, review_comments = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.totalKPIs,
          data.completedKPIs,
          data.overallScore,
          data.weightedScore,
          data.rating,
          data.status,
          data.reviewComments,
          existing[0].id
        ]
      );
    } else {
      // Insert new record
      await db.pool.execute(
        `INSERT INTO kra_performance_summary 
         (company_id, employee_type, employee_id, kra_id, 
          period_start, period_end, total_kpis, completed_kpis,
          overall_score, weighted_score, rating, status, review_comments, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          data.companyId,
          data.employeeType,
          data.employeeId,
          data.kraId,
          data.periodStart,
          data.periodEnd,
          data.totalKPIs,
          data.completedKPIs,
          data.overallScore,
          data.weightedScore,
          data.rating,
          data.status,
          data.reviewComments
        ]
      );
    }
  } catch (error) {
    logger.error('Error storing KRA performance summary:', error);
    throw error;
  }
};

module.exports = {
  calculateAndStoreKRAKPIPerformance
};

