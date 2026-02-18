# KRA/KPI Test Setup Instructions

This script creates a complete test environment with KRAs, KPIs, Test, and Questions to verify KRA/KPI auto-calculation.

## What This Script Creates

1. **Test Categories** (7 categories):
   - Leadership
   - Emotional Stability
   - Analytical Thinking
   - Communication Skills
   - Team Collaboration
   - Code Quality
   - Problem Solving

2. **Test**: "Psychometric Assessment - KRA/KPI Test"
   - 30 minutes duration
   - 10 questions
   - 60% passing score

3. **Questions** (14 questions):
   - 2 questions per category (covering all 7 categories)
   - Mix of MCQ_SINGLE, MCQ_MULTI, LIKERT, and NUMERIC question types

4. **KRAs** (6 KRAs for "Software Developer" role):
   - Code Quality & Maintainability (20%)
   - Feature Delivery (20%)
   - Bug Resolution (15%)
   - Performance Optimization (15%)
   - Security Compliance (15%)
   - Team Collaboration (15%)

5. **KPIs** (10 KPIs):
   - 2 KPIs under "Code Quality & Maintainability"
   - 2 KPIs under "Feature Delivery"
   - 2 KPIs under "Bug Resolution"
   - 1 KPI under "Performance Optimization"
   - 1 KPI under "Security Compliance"
   - 2 KPIs under "Team Collaboration"

6. **Sample Candidate**:
   - Email: `test.candidate@example.com`
   - Name: Test Candidate
   - All KRAs assigned
   - Test assigned

## How to Run

### Option 1: Using Node.js Script (Recommended)

```bash
cd backend
node scripts/setupKraKpiTest.js
```

### Option 2: Using SQL Script

```bash
# Using MySQL command line
mysql -u root -p your_database_name < backend/database/setup_kra_kpi_test_data.sql

# Or using MySQL Workbench
# Open the file backend/database/setup_kra_kpi_test_data.sql and execute it
```

## Testing the KRA/KPI Calculation

After running the setup script:

1. **Login as the candidate**:
   - Email: `test.candidate@example.com`
   - You may need to set a password first (if password setup is required)

2. **Start the test**:
   - Look for "Psychometric Assessment - KRA/KPI Test" in the candidate dashboard
   - Click "Start Test"

3. **Answer all questions**:
   - Answer all 10 questions
   - Submit the test

4. **Verify KRA/KPI Calculation**:
   - Check the `kpi_performance` table for KPI performance records
   - Check the `kra_performance_summary` table for KRA performance summaries
   - The system should automatically match test categories to KPIs:
     - "Code Quality" category → "Code Quality" KPI
     - "Team Collaboration" category → "Team Collaboration" KPI
     - "Communication Skills" category → "Communication Skills" KPI
     - etc.

## Expected Results

After test completion, you should see:

1. **KPI Performance Records** in `kpi_performance` table:
   - One record per matched KPI
   - Contains: `actual_value`, `achievement_percentage`, `rating`, `status`

2. **KRA Performance Summary** in `kra_performance_summary` table:
   - One record per KRA
   - Contains: `overall_score`, `weighted_score`, `rating`, `completed_kpis`

## Troubleshooting

### No KRA/KPI data is created

1. **Check if KRAs are assigned to candidate**:
   ```sql
   SELECT * FROM employee_kras WHERE employee_type = 'candidate' AND employee_id = <candidate_id>;
   ```

2. **Check if test has category scores**:
   ```sql
   SELECT category_scores FROM scores WHERE attempt_id = <attempt_id>;
   ```

3. **Check backend logs** for KRA/KPI calculation errors:
   - Look for: "Starting KRA/KPI calculation for attempt..."
   - Look for: "No KRAs found for candidate..."
   - Look for: "No matching test category found for KPI..."

### KPIs not matching test categories

The matching logic tries multiple strategies:
1. Exact match (KPI title = Category name)
2. Contains match (either direction)
3. Word-based matching
4. Keyword matching

**Solution**: Ensure KPI titles are similar to test category names. For example:
- Test Category: "Code Quality" → KPI Title: "Code Quality" ✅
- Test Category: "Team Collaboration" → KPI Title: "Team Collaboration" ✅

### Company ID Issues

If you get errors about company_id:
- The script assumes `company_id = 1`
- If your company has a different ID, update the script or SQL file

## Database Tables Involved

- `companies` - Company information
- `test_categories` - Test categories
- `tests` - Test information
- `test_categories_mapping` - Links categories to tests
- `questions` - Test questions
- `test_questions` - Links questions to tests
- `kras` - Key Result Areas
- `kpis` - Key Performance Indicators
- `employee_kras` - Assigns KRAs to candidates/employees
- `candidates` - Candidate information
- `test_assignments` - Assigns tests to candidates
- `test_attempts` - Test attempt records
- `scores` - Test scores with category breakdown
- `kpi_performance` - KPI performance records (created automatically)
- `kra_performance_summary` - KRA performance summaries (created automatically)

## Notes

- The script is idempotent - you can run it multiple times safely
- Existing records won't be duplicated
- The script creates a test candidate if one doesn't exist
- All KRAs are assigned to the test candidate automatically

