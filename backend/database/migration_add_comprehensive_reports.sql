-- Migration: Add comprehensive report fields
-- Run this if you have an existing database

-- Add fields to scores table for comprehensive reporting
ALTER TABLE scores 
ADD COLUMN IF NOT EXISTS raw_score DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS normalized_score DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS weighted_score DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS violation_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS recommendation_status ENUM('strong_hire', 'consider', 'not_recommended', 'reject') NULL,
ADD COLUMN IF NOT EXISTS risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
ADD COLUMN IF NOT EXISTS role_fit JSON NULL,
ADD COLUMN IF NOT EXISTS work_environment_fit JSON NULL,
ADD COLUMN IF NOT EXISTS behavioral_risks JSON NULL,
ADD COLUMN IF NOT EXISTS trait_interpretation TEXT NULL;

-- Add fields to test_attempts for integrity tracking
ALTER TABLE test_attempts 
ADD COLUMN IF NOT EXISTS violation_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tab_switch_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS fullscreen_exit_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS suspicion_risk_level ENUM('low', 'medium', 'high') DEFAULT 'low';

-- Create comprehensive report data table
CREATE TABLE IF NOT EXISTS comprehensive_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  test_id INT NOT NULL,
  candidate_id INT NOT NULL,
  company_id INT NOT NULL,
  report_type ENUM('hr_detailed', 'candidate_summary', 'comparative') NOT NULL,
  
  -- Section 1: Candidate Overview
  candidate_name VARCHAR(255),
  test_name VARCHAR(255),
  test_date DATETIME,
  duration_taken_seconds INT,
  attempt_number INT,
  violation_score INT DEFAULT 0,
  percentile_rank DECIMAL(5,2),
  
  -- Section 2: Overall Performance
  total_score DECIMAL(10,2),
  percentile_ranking DECIMAL(5,2),
  pass_fail_status ENUM('pass', 'fail'),
  benchmark_comparison JSON,
  company_average_comparison JSON,
  
  -- Section 3: Category-wise Analysis
  category_scores JSON,
  category_ranking JSON,
  
  -- Section 4: Trait Interpretation
  trait_interpretation TEXT,
  trait_details JSON,
  
  -- Section 5: Behavioral Risk Indicators
  behavioral_risks JSON,
  risk_indicators JSON,
  
  -- Section 6: Work Environment Fit
  work_environment_fit JSON,
  
  -- Section 7: Role Suitability
  role_suitability JSON,
  
  -- Section 8: Interview Guidance
  interview_guidance JSON,
  suggested_questions JSON,
  
  -- Section 9: Cheating / Integrity Summary
  total_violations INT DEFAULT 0,
  tab_switch_count INT DEFAULT 0,
  fullscreen_exit_count INT DEFAULT 0,
  suspicion_risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
  integrity_summary TEXT,
  
  -- Additional fields
  hiring_recommendation ENUM('strong_hire', 'consider', 'not_recommended', 'reject') NULL,
  recommendation_reason TEXT,
  company_name VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_attempt_report_type (attempt_id, report_type),
  INDEX idx_test (test_id),
  INDEX idx_candidate (candidate_id),
  INDEX idx_company (company_id),
  INDEX idx_report_type (report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

