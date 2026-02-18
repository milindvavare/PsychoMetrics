-- Migration: Add Test Category Mapping to KPIs
-- This allows explicit mapping of test categories to KPIs for automatic calculation

-- Add test_category_id to kpis table to map KPIs to test categories
ALTER TABLE kpis 
ADD COLUMN IF NOT EXISTS test_category_id INT NULL AFTER kra_id;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_kpi_test_category ON kpis (test_category_id);

-- Add foreign key constraint (if not exists)
-- Note: MySQL doesn't support IF NOT EXISTS for constraints, so this might fail if already exists
-- That's okay - just ignore the error if constraint already exists
SET @dbname = DATABASE();
SET @tablename = "kpis";
SET @constraintname = "fk_kpi_test_category";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (CONSTRAINT_NAME = @constraintname)
  ) > 0,
  "SELECT 'Constraint already exists'",
  CONCAT("ALTER TABLE ", @tablename, " ADD CONSTRAINT ", @constraintname, " FOREIGN KEY (test_category_id) REFERENCES test_categories(id) ON DELETE SET NULL")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Alternative simpler approach (if above doesn't work, use this):
-- ALTER TABLE kpis
-- ADD CONSTRAINT fk_kpi_test_category 
-- FOREIGN KEY (test_category_id) REFERENCES test_categories(id) ON DELETE SET NULL;

