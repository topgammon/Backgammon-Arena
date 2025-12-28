-- ============================================
-- DATABASE MIGRATION SCRIPT
-- Safe to run multiple times - won't break existing data
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add country column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'country'
  ) THEN
    ALTER TABLE public.users ADD COLUMN country TEXT DEFAULT 'US';
    RAISE NOTICE 'Added country column';
  ELSE
    RAISE NOTICE 'Country column already exists';
  END IF;
END $$;

-- 2. Add games_played column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'games_played'
  ) THEN
    ALTER TABLE public.users ADD COLUMN games_played INTEGER DEFAULT 0;
    RAISE NOTICE 'Added games_played column';
  ELSE
    RAISE NOTICE 'games_played column already exists';
  END IF;
END $$;

-- 3. Update existing users to have default values (if they're NULL)
UPDATE public.users 
SET country = 'US' 
WHERE country IS NULL;

UPDATE public.users 
SET games_played = 0 
WHERE games_played IS NULL;

-- 4. Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name IN ('country', 'games_played')
ORDER BY column_name;

