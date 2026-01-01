-- Check if google_avatar_url column exists in users table
-- Run this first to see the current status

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'google_avatar_url';

-- If the query above returns no rows, the column doesn't exist.
-- Run the following to add it:

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS google_avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.users.google_avatar_url IS 'Google profile photo URL for OAuth users';

-- Verify it was added (should return 1 row now)
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'google_avatar_url';

