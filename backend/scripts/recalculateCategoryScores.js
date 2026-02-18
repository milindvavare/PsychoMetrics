/**
 * Recalculate Category Scores for an Attempt
 * This script recalculates category scores for a specific attempt
 * 
 * Usage: node backend/scripts/recalculateCategoryScores.js <attempt_id>
 */

const db = require('../config/database');
const scoring = require('../utils/scoring');
const logger = require('../utils/logger');

async function recalculateScores(attemptId) {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔄 Recalculating Category Scores');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get attempt details
    const [attempts] = await db.pool.execute(
      'SELECT * FROM test_attempts WHERE id = ?',
      [attemptId]
    );

    if (attempts.length === 0) {
      console.error('❌ Attempt not found');
      process.exit(1);
    }

    const attempt = attempts[0];
    console.log(`✓ Attempt found: ${attempt.id}`);
    console.log(`  Test ID: ${attempt.test_id}`);
    console.log(`  Candidate ID: ${attempt.candidate_id}`);
    console.log(`  Status: ${attempt.status}`);

    // Check current scores
    const [currentScores] = await db.pool.execute(
      'SELECT category_scores FROM scores WHERE attempt_id = ?',
      [attemptId]
    );

    if (currentScores.length === 0) {
      console.error('❌ No scores record found. Test may not be submitted yet.');
      process.exit(1);
    }

    const currentCategoryScores = currentScores[0].category_scores;
    console.log(`\nCurrent category_scores: ${JSON.stringify(currentCategoryScores).substring(0, 200)}`);

    // Recalculate all scores
    console.log('\n🔄 Recalculating scores...');
    const scoreData = await scoring.calculateAllScores(
      attemptId,
      attempt.test_id,
      attempt.candidate_id
    );

    console.log(`\n✅ Scores recalculated!`);
    console.log(`   Total Score: ${scoreData.total_score}/${scoreData.max_score}`);
    console.log(`   Percentage: ${scoreData.percentage_score}%`);
    console.log(`   Categories: ${Object.keys(scoreData.category_scores).length}`);

    if (Object.keys(scoreData.category_scores).length > 0) {
      console.log(`\n   Category Scores:`);
      Object.values(scoreData.category_scores).forEach(cat => {
        console.log(`      - ${cat.category_name}: ${cat.percentage}% (${cat.score}/${cat.max_score})`);
      });
    } else {
      console.log(`\n   ⚠️  No category scores calculated. Check if:`);
      console.log(`      1. Questions have category_id assigned`);
      console.log(`      2. Test has categories mapped in test_categories_mapping`);
    }

    // Verify in database
    const [updatedScores] = await db.pool.execute(
      'SELECT category_scores FROM scores WHERE attempt_id = ?',
      [attemptId]
    );

    const updatedCategoryScores = typeof updatedScores[0].category_scores === 'string'
      ? JSON.parse(updatedScores[0].category_scores)
      : updatedScores[0].category_scores;

    console.log(`\n✅ Database updated with ${Object.keys(updatedCategoryScores).length} category scores`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Recalculation failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Get attempt ID from command line
const attemptId = process.argv[2];

if (!attemptId) {
  console.error('Usage: node backend/scripts/recalculateCategoryScores.js <attempt_id>');
  process.exit(1);
}

recalculateScores(parseInt(attemptId));



