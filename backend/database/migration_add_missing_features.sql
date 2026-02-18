-- Migration: Add missing features for psychometric module
-- Run this if you have an existing database

-- 1. Add skills table for question skill tagging
CREATE TABLE IF NOT EXISTS skills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_skill (company_id, name),
  INDEX idx_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add question-skills mapping (Many-to-Many)
CREATE TABLE IF NOT EXISTS question_skills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question_id INT NOT NULL,
  skill_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  UNIQUE KEY unique_question_skill (question_id, skill_id),
  INDEX idx_question (question_id),
  INDEX idx_skill (skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Add test versioning
ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS version VARCHAR(50) DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS parent_test_id INT NULL,
ADD COLUMN IF NOT EXISTS version_notes TEXT,
ADD INDEX idx_parent_test (parent_test_id),
ADD FOREIGN KEY (parent_test_id) REFERENCES tests(id) ON DELETE SET NULL;

-- 4. Add time tracking per question in answers table
ALTER TABLE answers 
ADD COLUMN IF NOT EXISTS time_spent_seconds INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT FALSE;

-- 5. Add disclaimer and consent tracking
ALTER TABLE test_attempts 
ADD COLUMN IF NOT EXISTS disclaimer_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMP NULL;

-- 6. Add device fingerprint and enhanced anti-cheating
ALTER TABLE test_attempts 
ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS user_agent TEXT NULL,
ADD COLUMN IF NOT EXISTS screen_resolution VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS suspicious_activity_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tab_switch_count INT DEFAULT 0,
ADD INDEX idx_device_fingerprint (device_fingerprint);

-- 7. Add normalized scoring and raw vs weighted score to scores table
ALTER TABLE scores 
ADD COLUMN IF NOT EXISTS raw_score DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS normalized_score DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS weighted_score DECIMAL(10,2) NULL;

-- 8. Add psychological insights table
CREATE TABLE IF NOT EXISTS psychological_insights (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  test_id INT NOT NULL,
  candidate_id INT NOT NULL,
  trait_radar_data JSON,
  leadership_potential_score DECIMAL(5,2),
  stress_tolerance_score DECIMAL(5,2),
  cultural_fit_index DECIMAL(5,2),
  learning_agility_score DECIMAL(5,2),
  team_compatibility_score DECIMAL(5,2),
  confidence_index DECIMAL(5,2),
  emotional_intelligence_breakdown JSON,
  behavioral_risk_indicator DECIMAL(5,2),
  dominant_personality_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attempt_insight (attempt_id),
  INDEX idx_test (test_id),
  INDEX idx_candidate (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Add GDPR and compliance fields
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  test_id INT NULL,
  retention_days INT DEFAULT 365,
  anonymize_after_days INT DEFAULT 90,
  auto_delete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL,
  INDEX idx_company (company_id),
  INDEX idx_test (test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Note: The settings JSON field in tests table can store:
-- {
--   "random_question_order": true/false,
--   "random_option_shuffle": true/false,
--   "show_disclaimer": true/false,
--   "disclaimer_text": "...",
--   "require_consent": true/false,
--   "consent_text": "...",
--   "multi_language": false,
--   "default_language": "en"
-- }

