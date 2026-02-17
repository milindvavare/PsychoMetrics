-- Migration: Add password fields to candidates table
-- Run this if you have an existing database

-- Add password_hash column if it doesn't exist
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) AFTER email;

-- Add password_setup_token column if it doesn't exist
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS password_setup_token VARCHAR(255) AFTER password_hash;

-- Add password_setup_expires column if it doesn't exist
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS password_setup_expires DATETIME AFTER password_setup_token;

-- Add status column if it doesn't exist
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive', 'blocked') DEFAULT 'active' AFTER metadata;

-- Add unique constraint if it doesn't exist
ALTER TABLE candidates 
ADD UNIQUE KEY IF NOT EXISTS unique_email_company (email, company_id);

-- Add index for password_setup_token if it doesn't exist
ALTER TABLE candidates 
ADD INDEX IF NOT EXISTS idx_password_setup_token (password_setup_token);

-- Note: If your MySQL version doesn't support IF NOT EXISTS, use this instead:
-- ALTER TABLE candidates ADD COLUMN password_hash VARCHAR(255) AFTER email;
-- ALTER TABLE candidates ADD COLUMN password_setup_token VARCHAR(255) AFTER password_hash;
-- ALTER TABLE candidates ADD COLUMN password_setup_expires DATETIME AFTER password_setup_token;
-- ALTER TABLE candidates ADD COLUMN status ENUM('active', 'inactive', 'blocked') DEFAULT 'active' AFTER metadata;

