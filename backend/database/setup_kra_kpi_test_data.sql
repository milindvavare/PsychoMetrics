-- Setup Script: Create Sample KRAs, KPIs, Test, and Questions for KRA/KPI Calculation
-- This script creates a complete test setup to verify KRA/KPI auto-calculation

-- Step 1: Create Test Categories (if they don't exist)
INSERT IGNORE INTO test_categories (company_id, name, description, weight, reverse_score) VALUES
(1, 'Leadership', 'Leadership and management capabilities', 1.00, FALSE),
(1, 'Emotional Stability', 'Emotional intelligence and stability', 1.00, FALSE),
(1, 'Analytical Thinking', 'Logical reasoning and problem-solving', 1.00, FALSE),
(1, 'Communication Skills', 'Verbal and written communication abilities', 1.00, FALSE),
(1, 'Team Collaboration', 'Ability to work in teams', 1.00, FALSE),
(1, 'Code Quality', 'Software code quality and maintainability', 1.00, FALSE),
(1, 'Problem Solving', 'Problem-solving and critical thinking', 1.00, FALSE);

-- Step 2: Create a Test
-- First, get or create a company (assuming company_id = 1 exists, if not, create it)
INSERT IGNORE INTO companies (id, name, status) VALUES
(1, 'Nirmatra Training Solutions', 'active');

-- Create a test for KRA/KPI calculation
INSERT INTO tests (
    company_id, 
    title, 
    description, 
    instructions,
    duration_minutes,
    total_questions,
    passing_score,
    negative_marking,
    status,
    settings,
    created_by
) VALUES (
    1,
    'Psychometric Assessment - KRA/KPI Test',
    'Comprehensive psychometric test for evaluating candidate performance across multiple dimensions',
    'Please answer all questions honestly. This test will be used to evaluate your performance across various KRAs and KPIs.',
    30,
    10,
    60,
    0,
    'active',
    '{"random_question_order": false, "random_option_shuffle": false, "disclaimer": "This test is confidential and will be used for evaluation purposes only.", "consent_required": true}',
    1
) ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Get the test ID (we'll use LAST_INSERT_ID() or a variable)
SET @test_id = LAST_INSERT_ID();
-- If test already exists, get its ID
SELECT id INTO @test_id FROM tests WHERE title = 'Psychometric Assessment - KRA/KPI Test' AND company_id = 1 LIMIT 1;

-- Step 3: Link Test Categories to Test
-- Get category IDs
SET @leadership_cat_id = (SELECT id FROM test_categories WHERE name = 'Leadership' AND company_id = 1 LIMIT 1);
SET @emotional_cat_id = (SELECT id FROM test_categories WHERE name = 'Emotional Stability' AND company_id = 1 LIMIT 1);
SET @analytical_cat_id = (SELECT id FROM test_categories WHERE name = 'Analytical Thinking' AND company_id = 1 LIMIT 1);
SET @communication_cat_id = (SELECT id FROM test_categories WHERE name = 'Communication Skills' AND company_id = 1 LIMIT 1);
SET @team_cat_id = (SELECT id FROM test_categories WHERE name = 'Team Collaboration' AND company_id = 1 LIMIT 1);
SET @code_quality_cat_id = (SELECT id FROM test_categories WHERE name = 'Code Quality' AND company_id = 1 LIMIT 1);
SET @problem_solving_cat_id = (SELECT id FROM test_categories WHERE name = 'Problem Solving' AND company_id = 1 LIMIT 1);

-- Link categories to test (if test_categories_mapping table exists)
-- Note: This table might not exist, so we'll handle it gracefully
INSERT IGNORE INTO test_categories_mapping (test_id, category_id, weight) VALUES
(@test_id, @leadership_cat_id, 1.00),
(@test_id, @emotional_cat_id, 1.00),
(@test_id, @analytical_cat_id, 1.00),
(@test_id, @communication_cat_id, 1.00),
(@test_id, @team_cat_id, 1.00),
(@test_id, @code_quality_cat_id, 1.00),
(@test_id, @problem_solving_cat_id, 1.00);

-- Step 4: Create Questions for the Test
-- Leadership Questions
INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty) VALUES
(1, 'In a team conflict, you would:', 'MCQ_SINGLE', 
 '["Avoid the conflict", "Listen to both sides and mediate", "Take sides immediately", "Report to management"]', 
 '["Listen to both sides and mediate"]', 10, @leadership_cat_id, 'medium'),
(1, 'When making decisions, you prefer to:', 'MCQ_SINGLE',
 '["Make quick decisions alone", "Consult team before deciding", "Always follow company policy", "Delegate to others"]',
 '["Consult team before deciding"]', 10, @leadership_cat_id, 'medium');

-- Emotional Stability Questions
INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty) VALUES
(1, 'How do you handle stress at work?', 'LIKERT',
 '["Never stressed", "Rarely stressed", "Sometimes stressed", "Often stressed", "Always stressed"]',
 '["Rarely stressed"]', 10, @emotional_cat_id, 'medium'),
(1, 'When facing criticism, you:', 'MCQ_SINGLE',
 '["Get defensive", "Take it personally", "Listen and learn", "Ignore it"]',
 '["Listen and learn"]', 10, @emotional_cat_id, 'medium');

-- Analytical Thinking Questions
INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty) VALUES
(1, 'If 5 machines can produce 100 units in 5 hours, how many units can 8 machines produce in 8 hours?', 'NUMERIC',
 NULL,
 '["256"]', 10, @analytical_cat_id, 'hard'),
(1, 'What is the next number in the sequence: 2, 6, 12, 20, 30, ?', 'NUMERIC',
 NULL,
 '["42"]', 10, @analytical_cat_id, 'hard');

-- Communication Skills Questions
INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty) VALUES
(1, 'When explaining complex topics, you:', 'MCQ_SINGLE',
 '["Use technical jargon", "Simplify and use examples", "Avoid explaining", "Write detailed documents"]',
 '["Simplify and use examples"]', 10, @communication_cat_id, 'medium'),
(1, 'Rate your written communication skills:', 'LIKERT',
 '["Excellent", "Good", "Average", "Below Average", "Poor"]',
 '["Good"]', 10, @communication_cat_id, 'medium');

-- Team Collaboration Questions
INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty) VALUES
(1, 'In team projects, you prefer to:', 'MCQ_SINGLE',
 '["Work independently", "Collaborate actively", "Lead the team", "Follow instructions"]',
 '["Collaborate actively"]', 10, @team_cat_id, 'easy'),
(1, 'When a team member is struggling, you:', 'MCQ_SINGLE',
 '["Focus on your own work", "Offer help and support", "Report to manager", "Take over their work"]',
 '["Offer help and support"]', 10, @team_cat_id, 'easy');

-- Code Quality Questions (for technical roles)
INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty) VALUES
(1, 'Code quality is important because:', 'MCQ_MULTI',
 '["It makes code maintainable", "It reduces bugs", "It improves team productivity", "It is not important"]',
 '["It makes code maintainable", "It reduces bugs", "It improves team productivity"]', 10, @code_quality_cat_id, 'medium'),
(1, 'You write unit tests:', 'LIKERT',
 '["Always", "Often", "Sometimes", "Rarely", "Never"]',
 '["Often"]', 10, @code_quality_cat_id, 'medium');

-- Problem Solving Questions
INSERT INTO questions (company_id, question_text, question_type, options, correct_answer, points, category_id, difficulty) VALUES
(1, 'When facing a difficult problem, your first step is:', 'MCQ_SINGLE',
 '["Ask for help immediately", "Break it down into smaller parts", "Give up", "Search online"]',
 '["Break it down into smaller parts"]', 10, @problem_solving_cat_id, 'medium'),
(1, 'Problem-solving approach: Rate your ability to identify root causes', 'LIKERT',
 '["Excellent", "Good", "Average", "Below Average", "Poor"]',
 '["Good"]', 10, @problem_solving_cat_id, 'medium');

-- Step 5: Link Questions to Test
-- Get question IDs and link them to the test
INSERT INTO test_questions (test_id, question_id, display_order) 
SELECT @test_id, id, ROW_NUMBER() OVER (ORDER BY id) as display_order
FROM questions 
WHERE company_id = 1 
  AND category_id IN (@leadership_cat_id, @emotional_cat_id, @analytical_cat_id, @communication_cat_id, @team_cat_id, @code_quality_cat_id, @problem_solving_cat_id)
ORDER BY category_id, id;

-- Step 6: Create KRAs (Key Result Areas)
-- For a Software Developer role
INSERT INTO kras (
    company_id,
    title,
    description,
    role_name,
    weight,
    evaluation_period,
    status,
    created_by
) VALUES
(1, 'Code Quality & Maintainability', 'Ensuring high-quality, maintainable code', 'Software Developer', 20, 'quarterly', 'active', 1),
(1, 'Feature Delivery', 'Delivering features on time and as per requirements', 'Software Developer', 20, 'quarterly', 'active', 1),
(1, 'Bug Resolution', 'Identifying and fixing bugs efficiently', 'Software Developer', 15, 'quarterly', 'active', 1),
(1, 'Performance Optimization', 'Optimizing code and system performance', 'Software Developer', 15, 'quarterly', 'active', 1),
(1, 'Security Compliance', 'Following security best practices', 'Software Developer', 15, 'quarterly', 'active', 1),
(1, 'Team Collaboration', 'Working effectively with team members', 'Software Developer', 15, 'quarterly', 'active', 1);

-- Get KRA IDs
SET @kra_code_quality_id = (SELECT id FROM kras WHERE title = 'Code Quality & Maintainability' AND company_id = 1 LIMIT 1);
SET @kra_feature_delivery_id = (SELECT id FROM kras WHERE title = 'Feature Delivery' AND company_id = 1 LIMIT 1);
SET @kra_bug_resolution_id = (SELECT id FROM kras WHERE title = 'Bug Resolution' AND company_id = 1 LIMIT 1);
SET @kra_performance_id = (SELECT id FROM kras WHERE title = 'Performance Optimization' AND company_id = 1 LIMIT 1);
SET @kra_security_id = (SELECT id FROM kras WHERE title = 'Security Compliance' AND company_id = 1 LIMIT 1);
SET @kra_collaboration_id = (SELECT id FROM kras WHERE title = 'Team Collaboration' AND company_id = 1 LIMIT 1);

-- Step 7: Create KPIs (Key Performance Indicators) under each KRA
-- KPIs for Code Quality & Maintainability
INSERT INTO kpis (
    company_id,
    kra_id,
    title,
    description,
    target_value,
    unit,
    weight,
    measurement_type,
    status
) VALUES
(1, @kra_code_quality_id, 'Code Quality', 'Code quality score from code reviews and tests', 80, 'percentage', 50, 'percentage', 'active'),
(1, @kra_code_quality_id, 'Code Maintainability', 'Maintainability index based on code complexity', 75, 'percentage', 50, 'percentage', 'active');

-- KPIs for Feature Delivery
INSERT INTO kpis (
    company_id,
    kra_id,
    title,
    description,
    target_value,
    unit,
    weight,
    measurement_type,
    status
) VALUES
(1, @kra_feature_delivery_id, 'On-Time Delivery', 'Percentage of features delivered on time', 90, 'percentage', 60, 'percentage', 'active'),
(1, @kra_feature_delivery_id, 'Requirement Adherence', 'Adherence to requirements and specifications', 85, 'percentage', 40, 'percentage', 'active');

-- KPIs for Bug Resolution
INSERT INTO kpis (
    company_id,
    kra_id,
    title,
    description,
    target_value,
    unit,
    weight,
    measurement_type,
    status
) VALUES
(1, @kra_bug_resolution_id, 'Bug Fix Time', 'Average time to fix bugs', 2, 'days', 50, 'numeric', 'active'),
(1, @kra_bug_resolution_id, 'Bug Detection Rate', 'Ability to identify bugs early', 80, 'percentage', 50, 'percentage', 'active');

-- KPIs for Performance Optimization
INSERT INTO kpis (
    company_id,
    kra_id,
    title,
    description,
    target_value,
    unit,
    weight,
    measurement_type,
    status
) VALUES
(1, @kra_performance_id, 'Performance Improvement', 'Performance optimization improvements', 70, 'percentage', 100, 'percentage', 'active');

-- KPIs for Security Compliance
INSERT INTO kpis (
    company_id,
    kra_id,
    title,
    description,
    target_value,
    unit,
    weight,
    measurement_type,
    status
) VALUES
(1, @kra_security_id, 'Security Best Practices', 'Adherence to security best practices', 90, 'percentage', 100, 'percentage', 'active');

-- KPIs for Team Collaboration
INSERT INTO kpis (
    company_id,
    kra_id,
    title,
    description,
    target_value,
    unit,
    weight,
    measurement_type,
    status
) VALUES
(1, @kra_collaboration_id, 'Team Collaboration', 'Collaboration effectiveness with team', 80, 'percentage', 50, 'percentage', 'active'),
(1, @kra_collaboration_id, 'Communication Skills', 'Effective communication with team members', 85, 'percentage', 50, 'percentage', 'active');

-- Step 8: Create a Sample Candidate (if doesn't exist)
INSERT IGNORE INTO candidates (
    company_id,
    email,
    first_name,
    last_name,
    status
) VALUES (
    1,
    'test.candidate@example.com',
    'Test',
    'Candidate',
    'active'
);

-- Get candidate ID
SET @candidate_id = (SELECT id FROM candidates WHERE email = 'test.candidate@example.com' AND company_id = 1 LIMIT 1);

-- Step 9: Assign KRAs to Candidate (via employee_kras table)
-- This links the candidate to the KRAs so the system knows which KRAs to calculate
INSERT INTO employee_kras (
    company_id,
    employee_type,
    employee_id,
    kra_id,
    status,
    assigned_at,
    assigned_by
) 
SELECT 
    1,
    'candidate',
    @candidate_id,
    id,
    'active',
    NOW(),
    1
FROM kras 
WHERE company_id = 1 
  AND role_name = 'Software Developer'
  AND status = 'active'
ON DUPLICATE KEY UPDATE status = 'active';

-- Step 10: Assign Test to Candidate (via test_assignments table)
INSERT INTO test_assignments (
    company_id,
    candidate_id,
    test_id,
    assigned_by,
    due_date,
    status
) VALUES (
    1,
    @candidate_id,
    @test_id,
    1,
    DATE_ADD(NOW(), INTERVAL 7 DAY),
    'assigned'
) ON DUPLICATE KEY UPDATE status = 'assigned';

-- Summary
SELECT 
    'Setup Complete!' as Status,
    (SELECT COUNT(*) FROM kras WHERE company_id = 1) as Total_KRAs,
    (SELECT COUNT(*) FROM kpis WHERE company_id = 1) as Total_KPIs,
    (SELECT COUNT(*) FROM questions WHERE company_id = 1) as Total_Questions,
    (SELECT COUNT(*) FROM tests WHERE company_id = 1 AND title = 'Psychometric Assessment - KRA/KPI Test') as Test_Created,
    (SELECT COUNT(*) FROM employee_kras WHERE employee_id = @candidate_id AND employee_type = 'candidate') as KRAs_Assigned_to_Candidate,
    @test_id as Test_ID,
    @candidate_id as Candidate_ID;

-- Instructions for Testing:
-- 1. Login as the candidate (test.candidate@example.com)
-- 2. Start the test "Psychometric Assessment - KRA/KPI Test"
-- 3. Answer all questions
-- 4. Submit the test
-- 5. The system will automatically calculate and store KRA/KPI performance
-- 6. Check the kpi_performance and kra_performance_summary tables for results

