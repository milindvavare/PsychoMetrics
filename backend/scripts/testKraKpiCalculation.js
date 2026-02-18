/**
 * Test Script: Test KRA/KPI Calculation
 * This script helps debug KRA/KPI calculation issues
 * 
 * Usage: node backend/scripts/testKraKpiCalculation.js <attempt_id>
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const kraKpiCalculator = require('../utils/kraKpiCalculator');

async function testCalculation(attemptId) {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🧪 Testing KRA/KPI Calculation');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Step 1: Get attempt details
    console.log('Step 1: Getting attempt details...');
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

    // Step 2: Get test company
    const [tests] = await db.pool.execute(
      'SELECT company_id FROM tests WHERE id = ?',
      [attempt.test_id]
    );

    if (tests.length === 0) {
      console.error('❌ Test not found');
      process.exit(1);
    }

    const companyId = tests[0].company_id;
    console.log(`✓ Company ID: ${companyId}`);

    // Step 3: Check scores
    console.log('\nStep 2: Checking scores...');
    const [scores] = await db.pool.execute(
      'SELECT category_scores, percentage_score FROM scores WHERE attempt_id = ?',
      [attemptId]
    );

    if (scores.length === 0) {
      console.error('❌ No scores found. Test may not be submitted yet.');
      process.exit(1);
    }

    console.log(`✓ Scores found`);
    const categoryScores = typeof scores[0].category_scores === 'string' 
      ? JSON.parse(scores[0].category_scores) 
      : scores[0].category_scores || {};

    console.log(`  Category scores: ${Object.keys(categoryScores).length} categories`);
    Object.values(categoryScores).forEach(cat => {
      console.log(`    - ${cat.category_name}: ${cat.percentage}%`);
    });

    // Step 4: Check KRAs
    console.log('\nStep 3: Checking assigned KRAs...');
    const [assignedKRAs] = await db.pool.execute(
      `SELECT ek.*, k.title as kra_title 
       FROM employee_kras ek
       JOIN kras k ON ek.kra_id = k.id
       WHERE ek.employee_type = 'candidate' 
         AND ek.employee_id = ? 
         AND ek.company_id = ?
         AND ek.status = 'active'`,
      [attempt.candidate_id, companyId]
    );

    if (assignedKRAs.length === 0) {
      console.error('❌ No KRAs assigned to candidate');
      console.error('  Please assign KRAs to candidate first');
      process.exit(1);
    }

    console.log(`✓ Found ${assignedKRAs.length} assigned KRAs:`);
    assignedKRAs.forEach(kra => {
      console.log(`    - ${kra.kra_title} (ID: ${kra.kra_id})`);
    });

    // Step 5: Check KPIs
    console.log('\nStep 4: Checking KPIs...');
    let totalKPIs = 0;
    for (const kra of assignedKRAs) {
      const [kpis] = await db.pool.execute(
        `SELECT kp.*, tc.name as test_category_name
         FROM kpis kp
         LEFT JOIN test_categories tc ON kp.test_category_id = tc.id
         WHERE kp.kra_id = ? AND kp.company_id = ? AND kp.status = 'active'`,
        [kra.kra_id, companyId]
      );
      totalKPIs += kpis.length;
      console.log(`  KRA "${kra.kra_title}": ${kpis.length} KPIs`);
      kpis.forEach(kpi => {
        const mapping = kpi.test_category_name ? `→ ${kpi.test_category_name}` : '(Not Mapped)';
        console.log(`    - ${kpi.title} ${mapping}`);
      });
    }

    if (totalKPIs === 0) {
      console.error('❌ No KPIs found for assigned KRAs');
      process.exit(1);
    }

    // Step 6: Run calculation
    console.log('\nStep 5: Running KRA/KPI calculation...');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const result = await kraKpiCalculator.calculateAndStoreKRAKPIPerformance(
      attemptId,
      attempt.test_id,
      attempt.candidate_id,
      companyId
    );

    console.log('\n═══════════════════════════════════════════════════════════');
    if (result.success) {
      console.log('✅ Calculation completed successfully!');
      console.log(`   Summary:`, result.summary);
    } else {
      console.log('❌ Calculation failed');
      console.log(`   Error: ${result.message}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    // Step 7: Verify results
    console.log('Step 6: Verifying stored data...');
    const [kpiPerf] = await db.pool.execute(
      `SELECT COUNT(*) as count FROM kpi_performance 
       WHERE employee_type = 'candidate' AND employee_id = ? AND company_id = ?`,
      [attempt.candidate_id, companyId]
    );

    const [kraPerf] = await db.pool.execute(
      `SELECT COUNT(*) as count FROM kra_performance_summary 
       WHERE employee_type = 'candidate' AND employee_id = ? AND company_id = ?`,
      [attempt.candidate_id, companyId]
    );

    console.log(`✓ KPI Performance Records: ${kpiPerf[0].count}`);
    console.log(`✓ KRA Performance Records: ${kraPerf[0].count}`);

    if (kpiPerf[0].count > 0 || kraPerf[0].count > 0) {
      console.log('\n✅ Data stored successfully!');
    } else {
      console.log('\n⚠️  No performance data stored. Check logs above for errors.');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Get attempt ID from command line
const attemptId = process.argv[2];

if (!attemptId) {
  console.error('Usage: node backend/scripts/testKraKpiCalculation.js <attempt_id>');
  process.exit(1);
}

testCalculation(parseInt(attemptId));



