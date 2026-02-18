-- Migration: Add Advanced Integrity Scoring Fields
-- Description: Adds confidence_index and updates risk_level enum to support 'critical' level
-- Date: 2024

-- Add confidence_index to scores table
ALTER TABLE scores
ADD COLUMN IF NOT EXISTS confidence_index DECIMAL(5,2) NULL COMMENT 'Adjusted confidence score (test score - risk penalty)';

-- Update risk_level enum in test_attempts to include 'critical'
-- Note: MySQL doesn't support direct enum modification, so we need to use ALTER TABLE with MODIFY
-- This will work if the table exists, otherwise it will be created with the new enum in schema.sql
ALTER TABLE test_attempts
MODIFY COLUMN suspicion_risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low';

-- Update risk_level enum in scores table to include 'critical'
ALTER TABLE scores
MODIFY COLUMN risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low';

-- Add index on confidence_index for faster queries
ALTER TABLE scores
ADD INDEX IF NOT EXISTS idx_confidence_index (confidence_index);

-- Add index on risk_level for faster filtering
ALTER TABLE scores
ADD INDEX IF NOT EXISTS idx_risk_level (risk_level);

-- Add integrity_recommendation JSON field to store full recommendation details
ALTER TABLE scores
ADD COLUMN IF NOT EXISTS integrity_recommendation JSON NULL COMMENT 'Full integrity recommendation object with action, status, and details';


