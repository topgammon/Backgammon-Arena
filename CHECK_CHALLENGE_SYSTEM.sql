-- Check if Challenge System is properly set up
-- Run this first to see what's missing

-- Check if message_type column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'messages' 
  AND column_name = 'message_type';

-- Check if challenge_id column exists in messages
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'messages' 
  AND column_name = 'challenge_id';

-- Check if challenges table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'challenges';

-- Check challenges table structure if it exists
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'challenges'
ORDER BY ordinal_position;

-- Check if foreign key constraint exists
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
  AND table_name = 'messages'
  AND constraint_name LIKE '%challenge%';

