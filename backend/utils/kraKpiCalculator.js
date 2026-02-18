const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Automatically calculate and store KRA/KPI performance from test results
 * This is called when a test is completed
 */
const calculateAndStoreKRAKPIPerformance = async (attemptId, testId, candidateId, companyId) => {
  try {
    logger.info(`═══════════════════════════════════════════════════════════`);
    logger.info(`🚀 Starting KRA/KPI calculation`);
    logger.info(`   Attempt ID: ${attemptId}`);
    logger.info(`   Test ID: ${testId}`);
    logger.info(`   Candidate ID: ${candidateId}`);
    logger.info(`   Company ID: ${companyId}`);
    logger.info(`═══════════════════════════════════════════════════════════`);
    
    // Step 1: Get test attempt details
    const [attempts] = await db.pool.execute(
      'SELECT * FROM test_attempts WHERE id = ?',
      [attemptId]
    );

    if (attempts.length === 0) {
      logger.error(`❌ Attempt ${attemptId} not found`);
      return { success: false, message: 'Attempt not found' };
    }

    const attempt = attempts[0];
    const submittedAt = attempt.submitted_at || new Date();
    logger.info(`✓ Attempt found. Status: ${attempt.status}, Submitted: ${submittedAt}`);

    // Step 2: Get test category scores from the scores table
    // Retry logic in case scores are still being saved
    let scores = [];
    let retries = 3;
    let scoreData = null;
    
    while (retries > 0 && scores.length === 0) {
      [scores] = await db.pool.execute(
        'SELECT category_scores, percentage_score FROM scores WHERE attempt_id = ?',
        [attemptId]
      );
      
      if (scores.length === 0) {
        logger.warn(`⚠️  Scores not found, retrying... (${retries} retries left)`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
      } else {
        scoreData = scores[0];
        break;
      }
    }

    if (!scoreData || scores.length === 0) {
      logger.error(`❌ No scores found for attempt ${attemptId} after ${3 - retries} retries.`);
      logger.error(`   Make sure test is submitted and scores are calculated.`);
      logger.error(`   Check if scores table has a record for attempt_id = ${attemptId}`);
      return { success: false, message: 'No scores found. Test may not be fully submitted or scores not calculated yet.' };
    }

    logger.info(`✓ Scores found for attempt ${attemptId}`);
    
    let categoryScores = {};
    
    try {
      // Handle different formats of category_scores
      if (typeof scoreData.category_scores === 'string') {
        if (scoreData.category_scores.trim() === '') {
          logger.error(`❌ category_scores is empty string`);
          return { success: false, message: 'Category scores are empty' };
        }
        categoryScores = JSON.parse(scoreData.category_scores);
      } else if (scoreData.category_scores && typeof scoreData.category_scores === 'object') {
        categoryScores = scoreData.category_scores;
      } else {
        logger.error(`❌ category_scores is null or invalid type: ${typeof scoreData.category_scores}`);
        return { success: false, message: 'Category scores are null or invalid' };
      }
      
      // Handle case where categoryScores might be an array instead of object
      if (Array.isArray(categoryScores)) {
        logger.info(`   Converting array format to object format`);
        const tempObj = {};
        categoryScores.forEach((cat, index) => {
          tempObj[cat.category_id || index] = cat;
        });
        categoryScores = tempObj;
      }
      
      if (!categoryScores || Object.keys(categoryScores).length === 0) {
        logger.error(`❌ No category scores found in attempt ${attemptId}`);
        logger.error(`   category_scores type: ${typeof scoreData.category_scores}`);
        logger.error(`   category_scores value: ${JSON.stringify(scoreData.category_scores).substring(0, 200)}`);
        return { success: false, message: 'No category scores found in test results' };
      }
      
      logger.info(`✓ Found ${Object.keys(categoryScores).length} category scores:`);
      Object.entries(categoryScores).forEach(([key, value]) => {
        const catName = value?.category_name || value?.name || key;
        const percentage = value?.percentage || value?.score || 0;
        logger.info(`   - ${catName}: ${percentage}%`);
      });
    } catch (parseError) {
      logger.error(`❌ Error parsing category_scores for attempt ${attemptId}:`, parseError);
      logger.error(`   Raw data type: ${typeof scoreData.category_scores}`);
      logger.error(`   Raw data (first 500 chars): ${String(scoreData.category_scores).substring(0, 500)}`);
      return { success: false, message: 'Error parsing category scores', error: parseError.message };
    }

    // Step 3: Get all test categories for the company (for mapping)
    const [allTestCategories] = await db.pool.execute(
      `SELECT id, name FROM test_categories WHERE company_id = ?`,
      [companyId]
    );
    logger.info(`✓ Found ${allTestCategories.length} test categories in company`);

    // Step 4: Get candidate's assigned KRAs
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

    logger.info(`✓ Found ${assignedKRAs.length} directly assigned KRAs for candidate ${candidateId}`);

    // If no KRAs assigned directly, try to get KRAs based on candidate's role
    if (assignedKRAs.length === 0) {
      logger.info(`⚠️  No KRAs directly assigned, checking for role-based KRAs...`);
      
      // Try to get candidate's role from test assignment or candidate profile
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
        try {
          const [candidateInfo] = await db.pool.execute(
            'SELECT role, position FROM candidates WHERE id = ?',
            [candidateId]
          );
          
          if (candidateInfo.length > 0) {
            roleName = candidateInfo[0].role || candidateInfo[0].position;
          }
        } catch (error) {
          logger.debug('Role column not found in candidates table');
        }
      }
      
      if (roleName) {
        [assignedKRAs] = await db.pool.execute(
          `SELECT k.id as kra_id, k.title as kra_title, k.role_name, k.evaluation_period, k.weight as kra_weight,
                  k.company_id, k.status, 'candidate' as employee_type, ? as employee_id
           FROM kras k
           WHERE k.role_name = ? 
             AND k.company_id = ?
             AND k.status = 'active'`,
          [candidateId, roleName, companyId]
        );
        
        logger.info(`✓ Found ${assignedKRAs.length} role-based KRAs for role "${roleName}"`);
      } else {
        logger.warn(`⚠️  No role found for candidate ${candidateId}`);
      }
    }

    if (assignedKRAs.length === 0) {
      const errorMsg = `❌ No KRAs found for candidate ${candidateId}. Please assign KRAs to the candidate or ensure candidate has a role that matches KRA role_name.`;
      logger.error(errorMsg);
      return { 
        success: false, 
        message: 'No KRAs assigned to candidate. Please assign KRAs in the system.',
        details: 'To enable KRA/KPI calculation: 1) Assign KRAs to candidate via employee_kras table, OR 2) Set candidate role to match KRA role_name'
      };
    }
    
    logger.info(`✓ Processing ${assignedKRAs.length} KRAs for candidate ${candidateId}`);

    // Step 5: Create category score map
    // categoryScores is an object where keys are category_id and values are category objects
    const categoryScoreMap = {};
    Object.values(categoryScores).forEach(cat => {
      if (cat && cat.category_name) {
        const catNameLower = cat.category_name.toLowerCase().trim();
        categoryScoreMap[catNameLower] = cat;
        // Also map by category_id for flexibility
        if (cat.category_id) {
          categoryScoreMap[`id_${cat.category_id}`] = cat;
        }
      }
    });
    logger.info(`✓ Created category score map with ${Object.keys(categoryScoreMap).length} entries`);
    logger.info(`   Mapped categories: ${Object.values(categoryScores).map(c => c?.category_name || 'N/A').join(', ')}`);

    // Step 6: Process each assigned KRA
    let totalKPIsProcessed = 0;
    let totalKPIsMatched = 0;
    let totalKRAsProcessed = 0;

    for (const assignedKRA of assignedKRAs) {
      try {
        const kraId = assignedKRA.kra_id;
        const evaluationPeriod = assignedKRA.evaluation_period || 'quarterly';
        
        logger.info(`\n📊 Processing KRA: ${assignedKRA.kra_title} (ID: ${kraId})`);
        
        // Calculate period dates
        const periodDates = calculatePeriodDates(submittedAt, evaluationPeriod);
        logger.info(`   Period: ${periodDates.start} to ${periodDates.end}`);
        
        // Get KPIs for this KRA (including test_category_id)
        const [kpis] = await db.pool.execute(
          `SELECT kp.*, tc.name as test_category_name
           FROM kpis kp
           LEFT JOIN test_categories tc ON kp.test_category_id = tc.id
           WHERE kp.kra_id = ? AND kp.company_id = ? AND kp.status = 'active'`,
          [kraId, companyId]
        );

        if (kpis.length === 0) {
          logger.warn(`   ⚠️  No KPIs found for KRA ${kraId} (${assignedKRA.kra_title})`);
          continue;
        }

        logger.info(`   ✓ Found ${kpis.length} KPIs for this KRA`);

        // Calculate KRA performance
        let kraScore = 0;
        let totalKPIWeight = 0;
        let completedKPIs = 0;

        // Process each KPI
        for (const kpi of kpis) {
          totalKPIsProcessed++;
          try {
            let matchingCategory = null;
            
            logger.info(`   🔍 Processing KPI: ${kpi.title} (ID: ${kpi.id})`);
            
            // First, check if KPI has explicit test_category_id mapping
            if (kpi.test_category_id) {
              const categoryId = kpi.test_category_id;
              const testCat = allTestCategories.find(tc => tc.id === categoryId);
              
              if (testCat) {
                const catNameLower = testCat.name.toLowerCase().trim();
                matchingCategory = categoryScoreMap[catNameLower];
                
                if (matchingCategory) {
                  logger.info(`      ✓ Using explicit mapping: "${testCat.name}" (ID: ${categoryId})`);
                } else {
                  logger.warn(`      ⚠️  Explicit mapping to "${testCat.name}" but category score not found in test results`);
                }
              } else {
                logger.warn(`      ⚠️  KPI has test_category_id ${categoryId} but category not found`);
              }
            }
            
            // If no explicit mapping, fall back to fuzzy matching
            if (!matchingCategory) {
              logger.info(`      🔎 No explicit mapping, trying fuzzy name matching...`);
              matchingCategory = findMatchingCategory(kpi, allTestCategories, categoryScoreMap);
              
              if (matchingCategory) {
                logger.info(`      ✓ Fuzzy match found: "${matchingCategory.category_name}"`);
              }
            }
            
            if (matchingCategory && matchingCategory.percentage !== undefined) {
              totalKPIsMatched++;
              const percentage = parseFloat(matchingCategory.percentage) || 0;
              
              // Calculate KPI performance
              const targetValue = parseFloat(kpi.target_value) || 100;
              const actualValue = percentage;
              const achievementPercentage = targetValue > 0 
                ? Math.min(100, (actualValue / targetValue) * 100) 
                : 0;

              const rating = calculateRating(achievementPercentage);

              logger.info(`      ✓ Calculated: actual=${actualValue}%, target=${targetValue}%, achievement=${achievementPercentage.toFixed(2)}%, rating=${rating}`);

              // Store KPI performance
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
                status: 'approved',
                comments: `Auto-calculated from test completion. Test: ${testId}, Attempt: ${attemptId}, Category: ${matchingCategory.category_name || 'N/A'}`,
                submittedBy: null
              });

              logger.info(`      ✅ KPI performance stored successfully`);

              // Accumulate for KRA score
              const kpiWeight = parseFloat(kpi.weight) || 1.0;
              kraScore += (achievementPercentage / 100) * kpiWeight;
              totalKPIWeight += kpiWeight;
              completedKPIs++;
            } else {
              logger.warn(`      ❌ No match found for KPI "${kpi.title}"`);
              logger.warn(`         Available categories: ${Object.keys(categoryScoreMap).join(', ')}`);
            }
          } catch (kpiError) {
            logger.error(`      ❌ Error processing KPI ${kpi.id} (${kpi.title}):`, kpiError);
          }
        }

        // Calculate overall KRA score
        const overallKRAScore = totalKPIWeight > 0 
          ? (kraScore / totalKPIWeight) * 100 
          : 0;

        const kraRating = calculateRating(overallKRAScore);

        logger.info(`   📈 KRA Summary: ${completedKPIs}/${kpis.length} KPIs matched, overall score: ${overallKRAScore.toFixed(2)}%, rating: ${kraRating}`);

        // Store KRA performance summary
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

          logger.info(`   ✅ KRA performance summary stored successfully`);
          totalKRAsProcessed++;
        } catch (kraError) {
          logger.error(`   ❌ Error storing KRA ${kraId} performance summary:`, kraError);
        }
      } catch (kraError) {
        logger.error(`❌ Error processing KRA ${assignedKRA.kra_id}:`, kraError);
      }
    }

    // Final summary
    logger.info(`\n═══════════════════════════════════════════════════════════`);
    logger.info(`✅ KRA/KPI Calculation Complete!`);
    logger.info(`   KRAs Processed: ${totalKRAsProcessed}`);
    logger.info(`   KPIs Processed: ${totalKPIsProcessed}`);
    logger.info(`   KPIs Matched: ${totalKPIsMatched}`);
    logger.info(`═══════════════════════════════════════════════════════════\n`);

    return {
      success: true,
      message: 'KRA/KPI calculation completed',
      summary: {
        krasProcessed: totalKRAsProcessed,
        kpisProcessed: totalKPIsProcessed,
        kpisMatched: totalKPIsMatched
      }
    };
  } catch (error) {
    logger.error(`\n❌❌❌ CRITICAL ERROR in KRA/KPI calculation ❌❌❌`);
    logger.error(`Attempt ID: ${attemptId}`);
    logger.error(`Error:`, error);
    logger.error(`Stack:`, error.stack);
    console.error('KRA/KPI Calculation Error Details:', {
      attemptId,
      testId,
      candidateId,
      companyId,
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      message: 'Error calculating KRA/KPI performance',
      error: error.message
    };
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
  const kpiTitleWords = kpiTitleLower.split(/\s+/).filter(w => w.length > 2);
  
  // Strategy 1: Exact match
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    if (categoryName === kpiTitleLower) {
      return scoreData;
    }
  }

  // Strategy 2: Contains match (either direction)
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    if (categoryName.includes(kpiTitleLower) || kpiTitleLower.includes(categoryName)) {
      return scoreData;
    }
  }

  // Strategy 3: Word-based matching
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    const categoryWords = categoryName.split(/\s+/).filter(w => w.length > 2);
    const commonWords = kpiTitleWords.filter(w => categoryWords.includes(w));
    
    if (commonWords.length > 0 && commonWords.length >= Math.min(kpiTitleWords.length, categoryWords.length) * 0.5) {
      return scoreData;
    }
  }

  // Strategy 4: Substring matching (handles "Analytical" -> "Analytical Thinking")
  for (const [categoryName, scoreData] of Object.entries(categoryScoreMap)) {
    if (kpiTitleLower.length < categoryName.length && categoryName.includes(kpiTitleLower)) {
      return scoreData;
    }
    if (categoryName.length < kpiTitleLower.length && kpiTitleLower.includes(categoryName)) {
      return scoreData;
    }
  }

  // Strategy 5: Keyword matching
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
          return scoreData;
        }
      }
    }
  }

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
      logger.debug(`Updated existing KPI performance record ${existing[0].id}`);
    } else {
      // Insert new record
      const [result] = await db.pool.execute(
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
      logger.debug(`Created new KPI performance record ${result.insertId}`);
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
      logger.debug(`Updated existing KRA performance summary ${existing[0].id}`);
    } else {
      // Insert new record
      const [result] = await db.pool.execute(
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
      logger.debug(`Created new KRA performance summary ${result.insertId}`);
    }
  } catch (error) {
    logger.error('Error storing KRA performance summary:', error);
    throw error;
  }
};

module.exports = {
  calculateAndStoreKRAKPIPerformance
};
