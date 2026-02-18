-- Quick Fix: Add test_category_id to kpis table if it doesn't exist
-- Run this if migration_add_kpi_category_mapping.sql hasn't been run yet

-- Check if column exists, if not add it
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kpis'
    AND COLUMN_NAME = 'test_category_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE kpis ADD COLUMN test_category_id INT NULL AFTER kra_id',
  'SELECT "Column test_category_id already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_kpi_test_category ON kpis (test_category_id);

-- Show current KPIs and their mapping status
SELECT 
  kp.id,
  kp.title as kpi_title,
  kp.test_category_id,
  tc.name as test_category_name,
  CASE 
    WHEN kp.test_category_id IS NULL THEN 'NOT MAPPED'
    ELSE 'MAPPED'
  END as mapping_status
FROM kpis kp
LEFT JOIN test_categories tc ON kp.test_category_id = tc.id
ORDER BY kp.id;

