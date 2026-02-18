# Test Completion Update - Comprehensive Report Generation

## Overview

When a candidate completes a test, the system now automatically:

1. **Calculates violation scores** from test integrity data
2. **Updates attempt and score records** with violation data
3. **Generates comprehensive report data** for both HR and candidate views
4. **Stores all report data** in the database

## Changes Made

### 1. Updated `submitAttempt` Function

**File:** `backend/controllers/attemptController.js`

**Changes:**
- Added violation score calculation
- Updates `test_attempts` table with:
  - `violation_score`
  - `tab_switch_count`
  - `fullscreen_exit_count`
  - `suspicion_risk_level`
- Updates `scores` table with:
  - `violation_score`
  - `risk_level`
- Automatically generates:
  - HR Detailed Report
  - Candidate Summary Report

### 2. Violation Score Calculation

The system calculates violation scores based on:

- **Tab switches:** 2 points each
- **Fullscreen exits:** 3 points each
- **Copy attempts:** 5 points
- **Paste attempts:** 5 points
- **Right-click attempts:** 3 points
- **Dev tools opened:** 10 points

**Risk Level Determination:**
- **Low:** < 10 points
- **Medium:** 10-19 points
- **High:** ≥ 20 points

### 3. Database Schema Updates

**Migration File:** `backend/database/migration_add_comprehensive_reports.sql`

**Added to `test_attempts` table:**
- `violation_score INT DEFAULT 0`
- `tab_switch_count INT DEFAULT 0`
- `fullscreen_exit_count INT DEFAULT 0`
- `suspicion_risk_level ENUM('low', 'medium', 'high') DEFAULT 'low'`

**Added to `scores` table:**
- `violation_score INT DEFAULT 0`
- `risk_level ENUM('low', 'medium', 'high') DEFAULT 'low'`
- `raw_score`, `normalized_score`, `weighted_score`
- `recommendation_status`
- `role_fit`, `work_environment_fit`, `behavioral_risks`, `trait_interpretation`

**New table:**
- `comprehensive_reports` - Stores all report data

## Flow When Test is Completed

1. **Candidate submits test** via `/api/attempts/submit`
2. **System calculates time taken**
3. **System calculates violation score** from:
   - Tab switches
   - Fullscreen exits
   - Suspicious activity (copy, paste, dev tools, etc.)
4. **System updates attempt record:**
   - Status: `completed`
   - `submitted_at`: Current timestamp
   - `time_taken_seconds`: Calculated duration
   - `violation_score`: Calculated score
   - `tab_switch_count`: Number of tab switches
   - `fullscreen_exit_count`: Number of fullscreen exits
   - `suspicion_risk_level`: Calculated risk level
5. **System calculates scores:**
   - Category scores
   - Total score
   - Percentage score
   - Percentile (if enabled)
   - Pass/fail status
6. **System updates scores record:**
   - All score data
   - `violation_score`
   - `risk_level`
7. **System generates comprehensive reports:**
   - HR Detailed Report (stored in `comprehensive_reports` table)
   - Candidate Summary Report (stored in `comprehensive_reports` table)
8. **System returns success response** with:
   - Attempt ID
   - Score data
   - Violation score
   - Risk level

## Backward Compatibility

The code handles both old and new column names:
- `tab_switches` (old) or `tab_switch_count` (new)
- Falls back gracefully if columns don't exist

## Error Handling

- Report generation errors are logged but don't fail test submission
- If report generation fails, the test is still marked as completed
- Scores are still calculated and saved
- Reports can be regenerated later if needed

## Testing

To test the update:

1. **Complete a test as a candidate**
2. **Check the database:**
   ```sql
   SELECT * FROM test_attempts WHERE id = <attempt_id>;
   SELECT * FROM scores WHERE attempt_id = <attempt_id>;
   SELECT * FROM comprehensive_reports WHERE attempt_id = <attempt_id>;
   ```
3. **Verify:**
   - `violation_score` is calculated
   - `risk_level` is set
   - Reports are generated
   - All data is stored correctly

## API Response

After test completion, the API returns:

```json
{
  "success": true,
  "message": "Test attempt submitted successfully",
  "data": {
    "attempt_id": 123,
    "score": {
      "total_score": 85.5,
      "percentage_score": 85.5,
      "percentile": 75.2,
      "passed": true,
      "category_scores": {...}
    },
    "violation_score": 5,
    "risk_level": "low"
  }
}
```

## Next Steps

1. **Run the migration** if not already done:
   ```bash
   mysql -u root -p psychometrics_db < backend/database/migration_add_comprehensive_reports.sql
   ```

2. **Test the flow:**
   - Complete a test
   - Verify reports are generated
   - Check violation scores are calculated

3. **View reports:**
   - HR can view detailed reports immediately
   - Candidates can view summary reports
   - All data is pre-calculated and ready



