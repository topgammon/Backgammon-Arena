-- ============================================
-- ADD AVATAR COLUMN TO USERS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add avatar column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'avatar'
  ) THEN
    ALTER TABLE public.users ADD COLUMN avatar TEXT DEFAULT 'Barry';
    RAISE NOTICE 'Added avatar column';
  ELSE
    RAISE NOTICE 'Avatar column already exists';
  END IF;
END $$;

-- Update existing users to have default avatar
UPDATE public.users 
SET avatar = 'Barry' 
WHERE avatar IS NULL;

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name = 'avatar';

