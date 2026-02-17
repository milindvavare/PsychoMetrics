-- Migration: Update question_type ENUM to support all question types
-- Run this if you have an existing database
-- This migration adds support for: MCQ_SINGLE, MCQ_MULTI, LIKERT, TRUE_FALSE, NUMERIC, SJT, RANKING

-- Step 1: Modify the column to allow all new question types
-- Note: MySQL doesn't support direct ENUM modification, so we need to use ALTER TABLE MODIFY
ALTER TABLE questions 
MODIFY COLUMN question_type ENUM(
  'multiple_choice', 
  'single_choice', 
  'true_false', 
  'rating_scale',
  'MCQ_SINGLE',
  'MCQ_MULTI',
  'LIKERT',
  'TRUE_FALSE',
  'NUMERIC',
  'SJT',
  'RANKING'
) DEFAULT 'MCQ_SINGLE';

-- Step 2: Migrate existing data from old types to new types (optional but recommended)
-- This ensures consistency across the database
UPDATE questions 
SET question_type = 'MCQ_SINGLE' 
WHERE question_type = 'single_choice';

UPDATE questions 
SET question_type = 'MCQ_MULTI' 
WHERE question_type = 'multiple_choice';

UPDATE questions 
SET question_type = 'TRUE_FALSE' 
WHERE question_type = 'true_false';

UPDATE questions 
SET question_type = 'LIKERT' 
WHERE question_type = 'rating_scale';

-- Step 3: Remove old ENUM values (optional - only if you want to clean up)
-- Uncomment the following if you want to remove old types after migration
-- ALTER TABLE questions 
-- MODIFY COLUMN question_type ENUM(
--   'MCQ_SINGLE',
--   'MCQ_MULTI',
--   'LIKERT',
--   'TRUE_FALSE',
--   'NUMERIC',
--   'SJT',
--   'RANKING'
-- ) DEFAULT 'MCQ_SINGLE';

