-- Migration: Add test_assignments table
-- Run this if you have an existing database

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

