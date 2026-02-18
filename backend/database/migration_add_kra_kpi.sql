-- Migration: Add KRA & KPI Management System
-- Run this if you have an existing database

-- KRAs (Key Result Areas) table
CREATE TABLE IF NOT EXISTS kras (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  weight DECIMAL(5,2) DEFAULT 1.00,
  status ENUM('active', 'inactive', 'archived') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_company (company_id),
  INDEX idx_status (status),
  INDEX idx_category (category)
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

-- KRA/KPI Templates (for quick setup)
CREATE TABLE IF NOT EXISTS kra_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  kras JSON,
  kpis JSON,
  is_default BOOLEAN DEFAULT FALSE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



