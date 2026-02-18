# Advanced Integrity Scoring System

## Overview

The Advanced Integrity Scoring System implements a sophisticated, weighted violation scoring approach that combines test performance with integrity risk assessment. Instead of using binary pass/fail logic, the system uses a nuanced scoring matrix to provide HR with actionable recommendations.

## Key Features

### 1. Weighted Violation Scoring

Each violation type is assigned specific point values:

| Violation | Points |
|-----------|--------|
| Tab switch | 10 |
| Fullscreen exit | 15 |
| Copy attempt | 10 |
| Rapid answering | 20 |
| Multiple login | 50 |

**Example:**
- Tab switch 5 times → 50 points
- Rapid answering detected → 20 points
- **Total Risk Score = 70**

### 2. Risk Level Classification

Risk scores are categorized into four levels:

| Risk Score | Level |
|------------|-------|
| 0-20 | Low |
| 21-50 | Medium |
| 51-80 | High |
| 80+ | Critical |

### 3. Time Pattern Analysis

The system analyzes answer timing patterns to detect suspicious behavior:

- **Rapid Answering**: Average time per question < 5 seconds
- **Uniform Patterns**: All answers identical or 80%+ same option
- **Unrealistic Completion**: Test completed in < 20% of allocated time
- **Too Fast**: Less than 5 seconds per question on average

### 4. Confidence Index

The Confidence Index adjusts the test score based on integrity risk:

```
Confidence Index = Test Score - (Risk Score × Weight)
```

**Example:**
- Test Score = 95%
- Risk Score = 70
- Confidence = 95 - 35 = 60%

### 5. Recommendation Matrix

The system provides recommendations based on a combination of test score and risk level:

| Test Score | Risk Level | Action |
|------------|------------|--------|
| High (≥80%) | Low | Accept |
| High (≥80%) | Medium | Flag for review |
| High (≥80%) | High/Critical | Require retest |
| Medium (60-79%) | Low/Medium | Flag for review |
| Medium (60-79%) | High/Critical | Require retest |
| Low (<60%) | High/Critical | Reject |
| Low (<60%) | Low/Medium | Flag for review |

## Implementation Details

### Database Schema

New fields added to `scores` table:
- `confidence_index` (DECIMAL): Adjusted confidence score
- `integrity_recommendation` (JSON): Full recommendation object

Updated fields:
- `risk_level` (ENUM): Now includes 'critical' level
- `violation_score` (INT): Weighted risk score

### API Response

When a test is submitted, the response includes:

```json
{
  "success": true,
  "data": {
    "attempt_id": 123,
    "score": { ... },
    "integrity": {
      "riskScore": 70,
      "riskLevel": "high",
      "confidenceIndex": 60.0,
      "recommendation": {
        "action": "require_retest",
        "status": "not_recommended",
        "message": "High score but high/critical integrity risk with suspicious time patterns. Require supervised retest.",
        "requiresReview": true,
        "requiresRetest": true,
        "reviewReason": "High/Critical risk (70 points) with suspicious time patterns detected"
      },
      "violations": {
        "tab_switches": 5,
        "fullscreen_exits": 0,
        "copy_attempts": 0,
        "rapid_answering": 1,
        "multiple_login": 0
      },
      "timePatterns": {
        "rapidAnswering": true,
        "uniformPattern": false,
        "unrealisticTime": false,
        "averageTimePerQuestion": 3.5,
        "flags": [...]
      }
    }
  }
}
```

### HR Dashboard Display

The system provides formatted integrity reports:

```
Candidate Score: 95%
Integrity Risk: High
Risk Score: 70
Confidence Index: 60.0%

Violations:
- Tab switches: 5
- Rapid answering: Detected

Recommendation: Require retest
Action: Retest required under supervision
```

## Migration

To apply the new integrity scoring system to an existing database:

```bash
mysql -u username -p database_name < backend/database/migration_add_integrity_scoring.sql
```

Or run the SQL file manually in your database management tool.

## Usage

The integrity scoring system is automatically applied when a test attempt is submitted. No additional configuration is required.

### Viewing Integrity Data

Integrity assessment data is included in:
- Test attempt details (`GET /api/attempts/:id`)
- Test submission response (`POST /api/attempts/submit`)
- Comprehensive reports

### Programmatic Access

To calculate integrity assessment programmatically:

```javascript
const integrityScoring = require('./utils/integrityScoring');

const assessment = await integrityScoring.calculateIntegrityAssessment(
  attemptId,
  testId,
  testScorePercentage
);

console.log(assessment.recommendation.message);
```

## Best Practices

1. **Never Auto-Reject High Scores**: Even with high risk, high-scoring candidates should be flagged for review, not automatically rejected.

2. **Combine with Live Assessment**: Use integrity flags to determine if additional verification (retest, interview) is needed.

3. **Review Time Patterns**: Pay attention to time pattern flags - they often indicate cheating more reliably than tab switches alone.

4. **Confidence Index**: Use the confidence index as an adjusted score that accounts for integrity concerns.

5. **Documentation**: Always document the review reason when flagging candidates for review or requiring retests.

## Example Scenarios

### Scenario 1: High Score, High Risk
- **Score**: 95%
- **Risk**: High (70 points - 5 tab switches + rapid answering)
- **Action**: Flag for review, require retest
- **Reason**: Perfect score with suspicious behavior patterns

### Scenario 2: High Score, Low Risk
- **Score**: 92%
- **Risk**: Low (5 points - 1 tab switch)
- **Action**: Accept
- **Reason**: High performance with minimal violations

### Scenario 3: Medium Score, Critical Risk
- **Score**: 65%
- **Risk**: Critical (85 points - multiple violations)
- **Action**: Reject or require retest
- **Reason**: Low performance combined with high integrity risk

## Technical Notes

- The system is backward compatible - if new database fields don't exist, it gracefully falls back to basic violation scoring.
- Risk levels are stored in the database, but 'critical' may be mapped to 'high' if the enum hasn't been updated yet.
- Time pattern analysis requires answer timestamps - ensure `answered_at` is properly tracked.

## Support

For questions or issues with the integrity scoring system, refer to:
- `backend/utils/integrityScoring.js` - Core implementation
- `backend/controllers/attemptController.js` - Integration point
- Database migration: `backend/database/migration_add_integrity_scoring.sql`


