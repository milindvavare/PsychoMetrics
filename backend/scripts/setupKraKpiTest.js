/**
 * Setup Script: Create Sample KRAs, KPIs, Test, and Questions for KRA/KPI Calculation
 * Run this script to set up a complete test environment for KRA/KPI auto-calculation
 * 
 * Usage: node backend/scripts/setupKraKpiTest.js
 */

const db = require('../config/database');
const logger = require('../utils/logger');

async function setupKraKpiTest() {
  try {
    logger.info('Starting KRA/KPI Test Setup...');

    // Step 1: Ensure company exists
    const [companies] = await db.pool.execute(
      'SELECT id FROM companies WHERE id = 1'
    );

    if (companies.length === 0) {
      await db.pool.execute(
        `INSERT INTO companies (id, name, status) VALUES (1, 'Nirmatra Training Solutions', 'active')`
      );
      logger.info('Company created');
    }

    const companyId = 1;

    // Step 2: Create Test Categories
    logger.info('Creating test categories...');
    const categories = [
      { name: 'Leadership', description: 'Leadership and management capabilities' },
      { name: 'Emotional Stability', description: 'Emotional intelligence and stability' },
      { name: 'Analytical Thinking', description: 'Logical reasoning and problem-solving' },
      { name: 'Communication Skills', description: 'Verbal and written communication abilities' },
      { name: 'Team Collaboration', description: 'Ability to work in teams' },
      { name: 'Code Quality', description: 'Software code quality and maintainability' },
      { name: 'Problem Solving', description: 'Problem-solving and critical thinking' }
    ];

    const categoryIds = {};
    for (const cat of categories) {
      const [existing] = await db.pool.execute(
        'SELECT id FROM test_categories WHERE name = ? AND company_id = ?',
        [cat.name, companyId]
      );

      if (existing.length === 0) {
        const [result] = await db.pool.execute(
          'INSERT INTO test_categories (company_id, name, description, weight) VALUES (?, ?, ?, ?)',
          [companyId, cat.name, cat.description, 1.00]
        );
        categoryIds[cat.name] = result.insertId;
        logger.info(`Created category: ${cat.name} (ID: ${result.insertId})`);
      } else {
        categoryIds[cat.name] = existing[0].id;
        logger.info(`Category already exists: ${cat.name} (ID: ${existing[0].id})`);
      }
    }

    // Step 3: Create Test
    logger.info('Creating test...');
    const [existingTest] = await db.pool.execute(
      'SELECT id FROM tests WHERE title = ? AND company_id = ?',
      ['Psychometric Assessment - KRA/KPI Test', companyId]
    );

    let testId;
    if (existingTest.length === 0) {
      const [testResult] = await db.pool.execute(
        `INSERT INTO tests (
          company_id, title, description, instructions,
          duration_minutes, total_questions, passing_score, negative_marking,
          status, settings, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          'Psychometric Assessment - KRA/KPI Test',
          'Comprehensive psychometric test for evaluating candidate performance across multiple dimensions',
          'Please answer all questions honestly. This test will be used to evaluate your performance across various KRAs and KPIs.',
          30, 10, 60, 0,
          'active',
          JSON.stringify({
            random_question_order: false,
            random_option_shuffle: false,
            disclaimer: 'This test is confidential and will be used for evaluation purposes only.',
            consent_required: true
          }),
          1
        ]
      );
      testId = testResult.insertId;
      logger.info(`Test created with ID: ${testId}`);
    } else {
      testId = existingTest[0].id;
      logger.info(`Test already exists with ID: ${testId}`);
    }

    // Step 4: Link Categories to Test
    logger.info('Linking categories to test...');
    for (const catName in categoryIds) {
      const catId = categoryIds[catName];
      const [existing] = await db.pool.execute(
        'SELECT id FROM test_categories_mapping WHERE test_id = ? AND category_id = ?',
        [testId, catId]
      );

      if (existing.length === 0) {
        await db.pool.execute(
          'INSERT INTO test_categories_mapping (test_id, category_id, weight) VALUES (?, ?, ?)',
          [testId, catId, 1.00]
        );
        logger.info(`Linked category ${catName} to test`);
      }
    }

    // Step 5: Create Questions
    logger.info('Creating questions...');
    const questions = [
      // Leadership
      {
        category: 'Leadership',
        text: 'In a team conflict, you would:',
        type: 'MCQ_SINGLE',
        options: JSON.stringify(['Avoid the conflict', 'Listen to both sides and mediate', 'Take sides immediately', 'Report to management']),
        correct: JSON.stringify(['Listen to both sides and mediate']),
        points: 10,
        difficulty: 'medium'
      },
      {
        category: 'Leadership',
        text: 'When making decisions, you prefer to:',
        type: 'MCQ_SINGLE',
        options: JSON.stringify(['Make quick decisions alone', 'Consult team before deciding', 'Always follow company policy', 'Delegate to others']),
        correct: JSON.stringify(['Consult team before deciding']),
        points: 10,
        difficulty: 'medium'
      },
      // Emotional Stability
      {
        category: 'Emotional Stability',
        text: 'How do you handle stress at work?',
        type: 'LIKERT',
        options: JSON.stringify(['Never stressed', 'Rarely stressed', 'Sometimes stressed', 'Often stressed', 'Always stressed']),
        correct: JSON.stringify(['Rarely stressed']),
        points: 10,
        difficulty: 'medium'
      },
      {
        category: 'Emotional Stability',
        text: 'When facing criticism, you:',
        type: 'MCQ_SINGLE',
        options: JSON.stringify(['Get defensive', 'Take it personally', 'Listen and learn', 'Ignore it']),
        correct: JSON.stringify(['Listen and learn']),
        points: 10,
        difficulty: 'medium'
      },
      // Analytical Thinking
      {
        category: 'Analytical Thinking',
        text: 'If 5 machines can produce 100 units in 5 hours, how many units can 8 machines produce in 8 hours?',
        type: 'NUMERIC',
        options: null,
        correct: JSON.stringify(['256']),
        points: 10,
        difficulty: 'hard'
      },
      {
        category: 'Analytical Thinking',
        text: 'What is the next number in the sequence: 2, 6, 12, 20, 30, ?',
        type: 'NUMERIC',
        options: null,
        correct: JSON.stringify(['42']),
        points: 10,
        difficulty: 'hard'
      },
      // Communication Skills
      {
        category: 'Communication Skills',
        text: 'When explaining complex topics, you:',
        type: 'MCQ_SINGLE',
        options: JSON.stringify(['Use technical jargon', 'Simplify and use examples', 'Avoid explaining', 'Write detailed documents']),
        correct: JSON.stringify(['Simplify and use examples']),
        points: 10,
        difficulty: 'medium'
      },
      {
        category: 'Communication Skills',
        text: 'Rate your written communication skills:',
        type: 'LIKERT',
        options: JSON.stringify(['Excellent', 'Good', 'Average', 'Below Average', 'Poor']),
        correct: JSON.stringify(['Good']),
        points: 10,
        difficulty: 'medium'
      },
      // Team Collaboration
      {
        category: 'Team Collaboration',
        text: 'In team projects, you prefer to:',
        type: 'MCQ_SINGLE',
        options: JSON.stringify(['Work independently', 'Collaborate actively', 'Lead the team', 'Follow instructions']),
        correct: JSON.stringify(['Collaborate actively']),
        points: 10,
        difficulty: 'easy'
      },
      {
        category: 'Team Collaboration',
        text: 'When a team member is struggling, you:',
        type: 'MCQ_SINGLE',
        options: JSON.stringify(['Focus on your own work', 'Offer help and support', 'Report to manager', 'Take over their work']),
        correct: JSON.stringify(['Offer help and support']),
        points: 10,
        difficulty: 'easy'
      },
      // Code Quality
      {
        category: 'Code Quality',
        text: 'Code quality is important because:',
        type: 'MCQ_MULTI',
        options: JSON.stringify(['It makes code maintainable', 'It reduces bugs', 'It improves team productivity', 'It is not important']),
        correct: JSON.stringify(['It makes code maintainable', 'It reduces bugs', 'It improves team productivity']),
        points: 10,
        difficulty: 'medium'
      },
      {
        category: 'Code Quality',
        text: 'You write unit tests:',
        type: 'LIKERT',
        options: JSON.stringify(['Always', 'Often', 'Sometimes', 'Rarely', 'Never']),
        correct: JSON.stringify(['Often']),
        points: 10,
        difficulty: 'medium'
      },
      // Problem Solving
      {
        category: 'Problem Solving',
        text: 'When facing a difficult problem, your first step is:',
        type: 'MCQ_SINGLE',
        options: JSON.stringify(['Ask for help immediately', 'Break it down into smaller parts', 'Give up', 'Search online']),
        correct: JSON.stringify(['Break it down into smaller parts']),
        points: 10,
        difficulty: 'medium'
      },
      {
        category: 'Problem Solving',
        text: 'Problem-solving approach: Rate your ability to identify root causes',
        type: 'LIKERT',
        options: JSON.stringify(['Excellent', 'Good', 'Average', 'Below Average', 'Poor']),
        correct: JSON.stringify(['Good']),
        points: 10,
        difficulty: 'medium'
      }
    ];

    const questionIds = [];
    for (const q of questions) {
      const catId = categoryIds[q.category];
      const [existing] = await db.pool.execute(
        'SELECT id FROM questions WHERE question_text = ? AND company_id = ?',
        [q.text, companyId]
      );

      if (existing.length === 0) {
        const [result] = await db.pool.execute(
          `INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [companyId, q.text, q.type, q.options, q.correct, q.points, catId, q.difficulty]
        );
        questionIds.push(result.insertId);
        logger.info(`Created question: ${q.text.substring(0, 50)}...`);
      } else {
        questionIds.push(existing[0].id);
      }
    }

    // Step 6: Link Questions to Test
    logger.info('Linking questions to test...');
    for (let i = 0; i < questionIds.length; i++) {
      const qId = questionIds[i];
      const [existing] = await db.pool.execute(
        'SELECT id FROM test_questions WHERE test_id = ? AND question_id = ?',
        [testId, qId]
      );

      if (existing.length === 0) {
        await db.pool.execute(
          'INSERT INTO test_questions (test_id, question_id, display_order) VALUES (?, ?, ?)',
          [testId, qId, i + 1]
        );
      }
    }

    // Step 7: Create KRAs
    logger.info('Creating KRAs...');
    const kras = [
      { title: 'Code Quality & Maintainability', description: 'Ensuring high-quality, maintainable code', role: 'Software Developer', weight: 20 },
      { title: 'Feature Delivery', description: 'Delivering features on time and as per requirements', role: 'Software Developer', weight: 20 },
      { title: 'Bug Resolution', description: 'Identifying and fixing bugs efficiently', role: 'Software Developer', weight: 15 },
      { title: 'Performance Optimization', description: 'Optimizing code and system performance', role: 'Software Developer', weight: 15 },
      { title: 'Security Compliance', description: 'Following security best practices', role: 'Software Developer', weight: 15 },
      { title: 'Team Collaboration', description: 'Working effectively with team members', role: 'Software Developer', weight: 15 }
    ];

    const kraIds = {};
    for (const kra of kras) {
      const [existing] = await db.pool.execute(
        'SELECT id FROM kras WHERE title = ? AND company_id = ? AND role_name = ?',
        [kra.title, companyId, kra.role]
      );

      if (existing.length === 0) {
        const [result] = await db.pool.execute(
          `INSERT INTO kras (company_id, title, description, role_name, weight, evaluation_period, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [companyId, kra.title, kra.description, kra.role, kra.weight, 'quarterly', 'active', 1]
        );
        kraIds[kra.title] = result.insertId;
        logger.info(`Created KRA: ${kra.title} (ID: ${result.insertId})`);
      } else {
        kraIds[kra.title] = existing[0].id;
        logger.info(`KRA already exists: ${kra.title} (ID: ${existing[0].id})`);
      }
    }

    // Step 8: Create KPIs
    logger.info('Creating KPIs...');
    const kpis = [
      { kra: 'Code Quality & Maintainability', title: 'Code Quality', target: 80, weight: 50 },
      { kra: 'Code Quality & Maintainability', title: 'Code Maintainability', target: 75, weight: 50 },
      { kra: 'Feature Delivery', title: 'On-Time Delivery', target: 90, weight: 60 },
      { kra: 'Feature Delivery', title: 'Requirement Adherence', target: 85, weight: 40 },
      { kra: 'Bug Resolution', title: 'Bug Fix Time', target: 2, weight: 50 },
      { kra: 'Bug Resolution', title: 'Bug Detection Rate', target: 80, weight: 50 },
      { kra: 'Performance Optimization', title: 'Performance Improvement', target: 70, weight: 100 },
      { kra: 'Security Compliance', title: 'Security Best Practices', target: 90, weight: 100 },
      { kra: 'Team Collaboration', title: 'Team Collaboration', target: 80, weight: 50 },
      { kra: 'Team Collaboration', title: 'Communication Skills', target: 85, weight: 50 }
    ];

    for (const kpi of kpis) {
      const kraId = kraIds[kpi.kra];
      const [existing] = await db.pool.execute(
        'SELECT id FROM kpis WHERE title = ? AND kra_id = ? AND company_id = ?',
        [kpi.title, kraId, companyId]
      );

      if (existing.length === 0) {
        await db.pool.execute(
          `INSERT INTO kpis (company_id, kra_id, title, description, target_value, unit, weight, measurement_type, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId, kraId, kpi.title,
            `KPI for ${kpi.title}`,
            kpi.target, 'percentage', kpi.weight, 'percentage', 'active'
          ]
        );
        logger.info(`Created KPI: ${kpi.title} under ${kpi.kra}`);
      }
    }

    // Step 9: Create Sample Candidate
    logger.info('Creating sample candidate...');
    const [existingCandidate] = await db.pool.execute(
      'SELECT id FROM candidates WHERE email = ? AND company_id = ?',
      ['test.candidate@example.com', companyId]
    );

    let candidateId;
    if (existingCandidate.length === 0) {
      const [result] = await db.pool.execute(
        'INSERT INTO candidates (company_id, email, first_name, last_name, status) VALUES (?, ?, ?, ?, ?)',
        [companyId, 'test.candidate@example.com', 'Test', 'Candidate', 'active']
      );
      candidateId = result.insertId;
      logger.info(`Created candidate with ID: ${candidateId}`);
    } else {
      candidateId = existingCandidate[0].id;
      logger.info(`Candidate already exists with ID: ${candidateId}`);
    }

    // Step 10: Assign KRAs to Candidate
    logger.info('Assigning KRAs to candidate...');
    for (const kraTitle in kraIds) {
      const kraId = kraIds[kraTitle];
      const [existing] = await db.pool.execute(
        'SELECT id FROM employee_kras WHERE employee_type = ? AND employee_id = ? AND kra_id = ?',
        ['candidate', candidateId, kraId]
      );

      if (existing.length === 0) {
        await db.pool.execute(
          `INSERT INTO employee_kras (company_id, employee_type, employee_id, kra_id, status, assigned_at, assigned_by)
           VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
          [companyId, 'candidate', candidateId, kraId, 'active', 1]
        );
        logger.info(`Assigned KRA "${kraTitle}" to candidate`);
      }
    }

    // Step 11: Assign Test to Candidate
    logger.info('Assigning test to candidate...');
    const [existingAssignment] = await db.pool.execute(
      'SELECT id FROM test_assignments WHERE candidate_id = ? AND test_id = ?',
      [candidateId, testId]
    );

    if (existingAssignment.length === 0) {
      await db.pool.execute(
        `INSERT INTO test_assignments (company_id, candidate_id, test_id, assigned_by, due_date, status)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), ?)`,
        [companyId, candidateId, testId, 1, 'assigned']
      );
      logger.info('Test assigned to candidate');
    }

    // Summary
    logger.info('\n=== Setup Complete ===');
    logger.info(`Test ID: ${testId}`);
    logger.info(`Candidate ID: ${candidateId}`);
    logger.info(`Candidate Email: test.candidate@example.com`);
    logger.info(`Total KRAs: ${Object.keys(kraIds).length}`);
    logger.info(`Total Questions: ${questionIds.length}`);
    logger.info('\nTo test KRA/KPI calculation:');
    logger.info('1. Login as candidate: test.candidate@example.com');
    logger.info('2. Start the test: "Psychometric Assessment - KRA/KPI Test"');
    logger.info('3. Answer all questions and submit');
    logger.info('4. Check kpi_performance and kra_performance_summary tables for results');

    process.exit(0);
  } catch (error) {
    logger.error('Setup error:', error);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run setup
setupKraKpiTest();

