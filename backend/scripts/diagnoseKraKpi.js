/**
 * Diagnostic Script: Check KRA/KPI Setup
 * This script checks if everything is set up correctly for KRA/KPI calculation
 * 
 * Usage: node backend/scripts/diagnoseKraKpi.js [company_id]
 */

const db = require('../config/database');

async function diagnose(companyId = 1) {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 KRA/KPI System Diagnostic');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check 1: Test Categories
    console.log('1️⃣  Checking Test Categories...');
    const [categories] = await db.pool.execute(
      'SELECT id, name FROM test_categories WHERE company_id = ?',
      [companyId]
    );
    console.log(`   ✓ Found ${categories.length} test categories`);
    if (categories.length > 0) {
      categories.slice(0, 5).forEach(cat => {
        console.log(`      - ${cat.name} (ID: ${cat.id})`);
      });
      if (categories.length > 5) {
        console.log(`      ... and ${categories.length - 5} more`);
      }
    } else {
      console.log('   ⚠️  No test categories found. Create categories first.');
    }

    // Check 2: KRAs
    console.log('\n2️⃣  Checking KRAs...');
    const [kras] = await db.pool.execute(
      'SELECT id, title, role_name, status FROM kras WHERE company_id = ?',
      [companyId]
    );
    console.log(`   ✓ Found ${kras.length} KRAs`);
    if (kras.length > 0) {
      kras.slice(0, 5).forEach(kra => {
        console.log(`      - ${kra.title} (Role: ${kra.role_name}, Status: ${kra.status})`);
      });
      if (kras.length > 5) {
        console.log(`      ... and ${kras.length - 5} more`);
      }
    } else {
      console.log('   ⚠️  No KRAs found. Create KRAs first.');
    }

    // Check 3: KPIs
    console.log('\n3️⃣  Checking KPIs...');
    const [kpis] = await db.pool.execute(
      `SELECT kp.id, kp.title, kp.kra_id, kp.test_category_id, kp.status, 
              k.title as kra_title, tc.name as category_name
       FROM kpis kp
       LEFT JOIN kras k ON kp.kra_id = k.id
       LEFT JOIN test_categories tc ON kp.test_category_id = tc.id
       WHERE kp.company_id = ?`,
      [companyId]
    );
    console.log(`   ✓ Found ${kpis.length} KPIs`);
    
    const mappedKPIs = kpis.filter(k => k.test_category_id);
    const unmappedKPIs = kpis.filter(k => !k.test_category_id);
    
    console.log(`      - ${mappedKPIs.length} with category mapping`);
    console.log(`      - ${unmappedKPIs.length} without category mapping`);
    
    if (unmappedKPIs.length > 0) {
      console.log('\n   ⚠️  Unmapped KPIs (will use fuzzy matching):');
      unmappedKPIs.slice(0, 5).forEach(kpi => {
        console.log(`      - ${kpi.title} (KRA: ${kpi.kra_title})`);
      });
    }

    // Check 4: Candidates
    console.log('\n4️⃣  Checking Candidates...');
    const [candidates] = await db.pool.execute(
      'SELECT id, email, first_name, last_name FROM candidates WHERE company_id = ? LIMIT 5',
      [companyId]
    );
    console.log(`   ✓ Found ${candidates.length} candidates (showing first 5)`);

    // Check 5: KRA Assignments
    console.log('\n5️⃣  Checking KRA Assignments...');
    const [assignments] = await db.pool.execute(
      `SELECT ek.employee_id, ek.employee_type, COUNT(*) as kra_count
       FROM employee_kras ek
       WHERE ek.company_id = ?
       GROUP BY ek.employee_id, ek.employee_type`,
      [companyId]
    );
    console.log(`   ✓ Found ${assignments.length} employees/candidates with assigned KRAs`);
    assignments.forEach(assign => {
      console.log(`      - ${assign.employee_type} ${assign.employee_id}: ${assign.kra_count} KRAs`);
    });

    // Check 6: Test Attempts
    console.log('\n6️⃣  Checking Recent Test Attempts...');
    const [attempts] = await db.pool.execute(
      `SELECT ta.id, ta.candidate_id, ta.test_id, ta.status, ta.submitted_at
       FROM test_attempts ta
       JOIN tests t ON ta.test_id = t.id
       WHERE t.company_id = ?
       ORDER BY ta.submitted_at DESC
       LIMIT 5`,
      [companyId]
    );
    console.log(`   ✓ Found ${attempts.length} recent attempts`);
    
    for (const attempt of attempts) {
      const [scores] = await db.pool.execute(
        'SELECT category_scores FROM scores WHERE attempt_id = ?',
        [attempt.id]
      );
      
      const [kpiPerf] = await db.pool.execute(
        `SELECT COUNT(*) as count FROM kpi_performance 
         WHERE employee_type = 'candidate' AND employee_id = ?`,
        [attempt.candidate_id]
      );
      
      const hasScores = scores.length > 0;
      const hasCategoryScores = hasScores && scores[0].category_scores;
      const hasKpiData = kpiPerf[0].count > 0;
      
      console.log(`\n   Attempt ${attempt.id} (${attempt.status}):`);
      console.log(`      - Has scores: ${hasScores ? '✓' : '✗'}`);
      console.log(`      - Has category scores: ${hasCategoryScores ? '✓' : '✗'}`);
      console.log(`      - Has KPI data: ${hasKpiData ? '✓' : '✗'}`);
      
      if (hasCategoryScores) {
        try {
          const catScores = typeof scores[0].category_scores === 'string'
            ? JSON.parse(scores[0].category_scores)
            : scores[0].category_scores;
          console.log(`      - Categories: ${Object.keys(catScores).length}`);
        } catch (e) {
          console.log(`      - ⚠️  Error parsing category scores`);
        }
      }
    }

    // Check 7: Database Schema
    console.log('\n7️⃣  Checking Database Schema...');
    
    // Check if test_category_id column exists in kpis table
    const [kpiColumns] = await db.pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'kpis' 
         AND COLUMN_NAME = 'test_category_id'`
    );
    
    if (kpiColumns.length > 0) {
      console.log('   ✓ test_category_id column exists in kpis table');
    } else {
      console.log('   ❌ test_category_id column MISSING in kpis table');
      console.log('      Run: mysql -u root -p < backend/database/migration_add_kpi_category_mapping.sql');
    }

    // Check if required tables exist
    const requiredTables = [
      'kras', 'kpis', 'employee_kras', 'kpi_performance', 'kra_performance_summary'
    ];
    
    for (const table of requiredTables) {
      const [tables] = await db.pool.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
      );
      
      if (tables.length > 0) {
        console.log(`   ✓ Table '${table}' exists`);
      } else {
        console.log(`   ❌ Table '${table}' MISSING`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Diagnostic Complete');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

const companyId = process.argv[2] ? parseInt(process.argv[2]) : 1;
diagnose(companyId);

