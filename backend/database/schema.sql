-- Psychometrics SaaS Database Schema

-- Companies table (Multi-tenant support)
CREATE TABLE IF NOT EXISTS companies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE,
  subscription_tier ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
  status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_domain (domain),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users table (Company admins, HR, etc.)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('super_admin', 'admin', 'hr', 'viewer') DEFAULT 'viewer',
  status ENUM('active', 'inactive') DEFAULT 'active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_email_company (email, company_id),
  INDEX idx_company (company_id),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  password_setup_token VARCHAR(255),
  password_setup_expires DATETIME,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  resume_url TEXT,
  metadata JSON,
  status ENUM('active', 'inactive', 'blocked') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_email_company (email, company_id),
  INDEX idx_company (company_id),
  INDEX idx_email (email),
  INDEX idx_password_setup_token (password_setup_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test Categories table
CREATE TABLE IF NOT EXISTS test_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  weight DECIMAL(5,2) DEFAULT 1.00,
  reverse_score BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  duration_minutes INT,
  total_questions INT,
  passing_score DECIMAL(5,2),
  max_attempts INT DEFAULT 1,
  negative_marking BOOLEAN DEFAULT FALSE,
  negative_mark_percentage DECIMAL(5,2) DEFAULT 0.00,
  enable_percentile BOOLEAN DEFAULT TRUE,
  enable_ai_interpretation BOOLEAN DEFAULT TRUE,
  enable_benchmark BOOLEAN DEFAULT TRUE,
  enable_shortlist BOOLEAN DEFAULT TRUE,
  status ENUM('draft', 'active', 'archived') DEFAULT 'draft',
  settings JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_company (company_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test-Category mapping (Many-to-Many)
CREATE TABLE IF NOT EXISTS test_categories_mapping (
  id INT PRIMARY KEY AUTO_INCREMENT,
  test_id INT NOT NULL,
  category_id INT NOT NULL,
  weight DECIMAL(5,2) DEFAULT 1.00,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES test_categories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_test_category (test_id, category_id),
  INDEX idx_test (test_id),
  INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  category_id INT,
  question_text TEXT NOT NULL,
  question_type ENUM('MCQ_SINGLE', 'MCQ_MULTI', 'LIKERT', 'TRUE_FALSE', 'NUMERIC', 'SJT', 'RANKING') DEFAULT 'MCQ_SINGLE',
  options JSON NOT NULL,
  correct_answer JSON NOT NULL,
  points DECIMAL(5,2) DEFAULT 1.00,
  negative_points DECIMAL(5,2) DEFAULT 0.00,
  difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  explanation TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES test_categories(id) ON DELETE SET NULL,
  INDEX idx_company (company_id),
  INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test-Question mapping (Many-to-Many)
CREATE TABLE IF NOT EXISTS test_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  test_id INT NOT NULL,
  question_id INT NOT NULL,
  display_order INT DEFAULT 0,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_test_question (test_id, question_id),
  INDEX idx_test (test_id),
  INDEX idx_question (question_id),
  INDEX idx_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test Attempts table
CREATE TABLE IF NOT EXISTS test_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  test_id INT NOT NULL,
  candidate_id INT NOT NULL,
  attempt_number INT NOT NULL,
  status ENUM('in_progress', 'completed', 'abandoned', 'timeout') DEFAULT 'in_progress',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  time_taken_seconds INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  tab_switches INT DEFAULT 0,
  tab_switch_count INT DEFAULT 0,
  fullscreen_exit_count INT DEFAULT 0,
  violation_score INT DEFAULT 0,
  suspicion_risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
  suspicious_activity JSON,
  metadata JSON,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  UNIQUE KEY unique_test_candidate_attempt (test_id, candidate_id, attempt_number),
  INDEX idx_test (test_id),
  INDEX idx_candidate (candidate_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Answers table
CREATE TABLE IF NOT EXISTS answers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  answer_data JSON NOT NULL,
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2) DEFAULT 0.00,
  time_taken_seconds INT,
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attempt_question (attempt_id, question_id),
  INDEX idx_attempt (attempt_id),
  INDEX idx_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  test_id INT NOT NULL,
  candidate_id INT NOT NULL,
  total_score DECIMAL(10,2) DEFAULT 0.00,
  max_score DECIMAL(10,2) DEFAULT 0.00,
  percentage_score DECIMAL(5,2) DEFAULT 0.00,
  percentile DECIMAL(5,2),
  category_scores JSON,
  passed BOOLEAN DEFAULT FALSE,
  raw_score DECIMAL(10,2) NULL,
  normalized_score DECIMAL(10,2) NULL,
  weighted_score DECIMAL(10,2) NULL,
  violation_score INT DEFAULT 0,
  recommendation_status ENUM('strong_hire', 'consider', 'not_recommended', 'reject') NULL,
  risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
  role_fit JSON NULL,
  work_environment_fit JSON NULL,
  behavioral_risks JSON NULL,
  trait_interpretation TEXT NULL,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attempt_score (attempt_id),
  INDEX idx_test (test_id),
  INDEX idx_candidate (candidate_id),
  INDEX idx_percentile (percentile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Benchmarks table
CREATE TABLE IF NOT EXISTS benchmarks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  test_id INT,
  category_id INT,
  benchmark_name VARCHAR(255) NOT NULL,
  min_score DECIMAL(10,2),
  max_score DECIMAL(10,2),
  percentile_range JSON,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES test_categories(id) ON DELETE SET NULL,
  INDEX idx_company (company_id),
  INDEX idx_test (test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI Interpretations table
CREATE TABLE IF NOT EXISTS ai_interpretations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  interpretation_text TEXT NOT NULL,
  strengths JSON,
  weaknesses JSON,
  recommendations JSON,
  confidence_score DECIMAL(5,2),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attempt_interpretation (attempt_id),
  INDEX idx_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shortlist Recommendations table
CREATE TABLE IF NOT EXISTS shortlist_recommendations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  test_id INT NOT NULL,
  candidate_id INT NOT NULL,
  recommendation_score DECIMAL(5,2),
  recommendation_status ENUM('recommended', 'not_recommended', 'maybe') DEFAULT 'maybe',
  reasoning TEXT,
  factors JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  INDEX idx_company (company_id),
  INDEX idx_test (test_id),
  INDEX idx_candidate (candidate_id),
  INDEX idx_status (recommendation_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test Assignments table (Assign tests to specific candidates)
CREATE TABLE IF NOT EXISTS test_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  test_id INT NOT NULL,
  candidate_id INT NOT NULL,
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date DATETIME,
  status ENUM('assigned', 'in_progress', 'completed', 'expired') DEFAULT 'assigned',
  notes TEXT,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_test_candidate (test_id, candidate_id),
  INDEX idx_test (test_id),
  INDEX idx_candidate (candidate_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reports table (for tracking generated reports)
CREATE TABLE IF NOT EXISTS reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  report_type ENUM('detailed', 'summary', 'comparative') DEFAULT 'detailed',
  file_path TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  INDEX idx_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- KRAs (Key Result Areas) table
CREATE TABLE IF NOT EXISTS kras (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  role_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  weight DECIMAL(5,2) DEFAULT 1.00,
  evaluation_period ENUM('monthly', 'quarterly', 'half_yearly', 'yearly') DEFAULT 'quarterly',
  status ENUM('active', 'inactive', 'archived') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_company (company_id),
  INDEX idx_status (status),
  INDEX idx_role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- KPIs (Key Performance Indicators) table
CREATE TABLE IF NOT EXISTS kpis (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  kra_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  measurement_type ENUM('percentage', 'number', 'currency', 'rating', 'boolean', 'text') DEFAULT 'percentage',
  target_value DECIMAL(10,2),
  unit VARCHAR(50),
  frequency ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom') DEFAULT 'monthly',
  weight DECIMAL(5,2) DEFAULT 1.00,
  formula TEXT,
  status ENUM('active', 'inactive', 'archived') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (kra_id) REFERENCES kras(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_company (company_id),
  INDEX idx_kra (kra_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Employee/Candidate KRA Assignments
CREATE TABLE IF NOT EXISTS employee_kras (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  employee_type ENUM('user', 'candidate') NOT NULL,
  employee_id INT NOT NULL,
  kra_id INT NOT NULL,
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  start_date DATE,
  end_date DATE,
  weight DECIMAL(5,2) DEFAULT 1.00,
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  notes TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (kra_id) REFERENCES kras(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_employee_kra (employee_type, employee_id, kra_id, start_date),
  INDEX idx_company (company_id),
  INDEX idx_employee (employee_type, employee_id),
  INDEX idx_kra (kra_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- KPI Performance Tracking
CREATE TABLE IF NOT EXISTS kpi_performance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  employee_type ENUM('user', 'candidate') NOT NULL,
  employee_id INT NOT NULL,
  kpi_id INT NOT NULL,
  kra_id INT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  achievement_percentage DECIMAL(5,2),
  rating ENUM('excellent', 'good', 'satisfactory', 'needs_improvement', 'poor') NULL,
  status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
  submitted_by INT,
  submitted_at TIMESTAMP NULL,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  comments TEXT,
  evidence_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (kpi_id) REFERENCES kpis(id) ON DELETE CASCADE,
  FOREIGN KEY (kra_id) REFERENCES kras(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_employee_kpi_period (employee_type, employee_id, kpi_id, period_start, period_end),
  INDEX idx_company (company_id),
  INDEX idx_employee (employee_type, employee_id),
  INDEX idx_kpi (kpi_id),
  INDEX idx_kra (kra_id),
  INDEX idx_period (period_start, period_end),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- KRA Performance Summary
CREATE TABLE IF NOT EXISTS kra_performance_summary (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  employee_type ENUM('user', 'candidate') NOT NULL,
  employee_id INT NOT NULL,
  kra_id INT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_kpis INT DEFAULT 0,
  completed_kpis INT DEFAULT 0,
  overall_score DECIMAL(5,2),
  weighted_score DECIMAL(5,2),
  rating ENUM('excellent', 'good', 'satisfactory', 'needs_improvement', 'poor') NULL,
  status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
  submitted_by INT,
  submitted_at TIMESTAMP NULL,
  approved_by INT,
  approved_at TIMESTAMP NULL,
  review_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (kra_id) REFERENCES kras(id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_employee_kra_period (employee_type, employee_id, kra_id, period_start, period_end),
  INDEX idx_company (company_id),
  INDEX idx_employee (employee_type, employee_id),
  INDEX idx_kra (kra_id),
  INDEX idx_period (period_start, period_end),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

