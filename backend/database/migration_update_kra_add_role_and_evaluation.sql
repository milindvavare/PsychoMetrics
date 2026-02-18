-- Migration: Update KRA table to add role_name and evaluation_period
-- Run this to update existing KRA structure
-- 
-- IMPORTANT: Run these commands one by one in your MySQL client
-- If a column already exists, skip that ALTER TABLE command

-- Step 1: Add role_name column (run only if column doesn't exist)
ALTER TABLE kras ADD COLUMN role_name VARCHAR(255) NULL;

-- Step 2: Add evaluation_period column (run only if column doesn't exist)
ALTER TABLE kras ADD COLUMN evaluation_period ENUM('monthly', 'quarterly', 'half_yearly', 'yearly') DEFAULT 'quarterly';

-- Step 3: Update existing KRAs to have a default role_name
UPDATE kras SET role_name = 'General' WHERE role_name IS NULL;

-- Step 4: Make role_name NOT NULL (run after step 3 completes successfully)
ALTER TABLE kras MODIFY COLUMN role_name VARCHAR(255) NOT NULL;

-- Step 5: Add index for role_name (run only if index doesn't exist)
CREATE INDEX idx_role_name ON kras (role_name);

