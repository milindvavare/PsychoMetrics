-- Quick Fix: Add missing columns to kras table
-- Run this SQL script in your MySQL database if KRA creation is failing

-- Check if role_name column exists, if not add it
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'kras' 
    AND COLUMN_NAME = 'role_name'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE kras ADD COLUMN role_name VARCHAR(255) NULL',
  'SELECT "Column role_name already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if evaluation_period column exists, if not add it
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'kras' 
    AND COLUMN_NAME = 'evaluation_period'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE kras ADD COLUMN evaluation_period ENUM(\'monthly\', \'quarterly\', \'half_yearly\', \'yearly\') DEFAULT \'quarterly\'',
  'SELECT "Column evaluation_period already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing records
UPDATE kras SET role_name = 'General' WHERE role_name IS NULL;

-- Make role_name NOT NULL (only if all rows have values now)
-- Uncomment the next line after verifying all rows have role_name
-- ALTER TABLE kras MODIFY COLUMN role_name VARCHAR(255) NOT NULL;

-- Add index if it doesn't exist
SET @index_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'kras' 
    AND INDEX_NAME = 'idx_role_name'
);

SET @sql = IF(@index_exists = 0,
  'CREATE INDEX idx_role_name ON kras (role_name)',
  'SELECT "Index idx_role_name already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration completed! Please verify the columns exist.' AS status;



