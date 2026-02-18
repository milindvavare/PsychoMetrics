-- Migration: Update KRA table to add role_name and evaluation_period
-- Run this to update existing KRA structure
-- This is a simpler version that works with MySQL

-- Step 1: Check and add role_name column
-- Run this manually if the column doesn't exist:
-- ALTER TABLE kras ADD COLUMN role_name VARCHAR(255) NULL AFTER category;

-- Step 2: Check and add evaluation_period column  
-- Run this manually if the column doesn't exist:
-- ALTER TABLE kras ADD COLUMN evaluation_period ENUM('monthly', 'quarterly', 'half_yearly', 'yearly') DEFAULT 'quarterly' AFTER weight;

-- Step 3: Update existing KRAs to have a default role_name
UPDATE kras SET role_name = 'General' WHERE role_name IS NULL;

-- Step 4: Make role_name NOT NULL (run after step 3)
-- ALTER TABLE kras MODIFY COLUMN role_name VARCHAR(255) NOT NULL;

-- Step 5: Add index for role_name
-- CREATE INDEX idx_role_name ON kras (role_name);

-- Complete migration script (run all at once if columns don't exist):
-- 
-- ALTER TABLE kras ADD COLUMN role_name VARCHAR(255) NULL;
-- ALTER TABLE kras ADD COLUMN evaluation_period ENUM('monthly', 'quarterly', 'half_yearly', 'yearly') DEFAULT 'quarterly';
-- UPDATE kras SET role_name = 'General' WHERE role_name IS NULL;
-- ALTER TABLE kras MODIFY COLUMN role_name VARCHAR(255) NOT NULL;
-- CREATE INDEX idx_role_name ON kras (role_name);



