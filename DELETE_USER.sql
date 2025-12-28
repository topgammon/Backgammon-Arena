-- ============================================
-- SAFE USER DELETION SCRIPT
-- Run this in Supabase SQL Editor
-- ============================================

-- Option 1: Delete by email (replace with actual email)
-- First, get the user ID
DO $$
DECLARE
  user_id_to_delete UUID;
BEGIN
  -- Find user by email
  SELECT id INTO user_id_to_delete
  FROM auth.users
  WHERE email = 'user@example.com'; -- REPLACE WITH ACTUAL EMAIL
  
  IF user_id_to_delete IS NOT NULL THEN
    -- Delete from public.users first (if exists)
    DELETE FROM public.users WHERE id = user_id_to_delete;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    
    RAISE NOTICE 'User deleted successfully';
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;

-- Option 2: Delete by username (replace with actual username)
DO $$
DECLARE
  user_id_to_delete UUID;
BEGIN
  -- Find user by username
  SELECT id INTO user_id_to_delete
  FROM public.users
  WHERE username = 'testuser'; -- REPLACE WITH ACTUAL USERNAME
  
  IF user_id_to_delete IS NOT NULL THEN
    -- Delete from public.users first
    DELETE FROM public.users WHERE id = user_id_to_delete;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    
    RAISE NOTICE 'User deleted successfully';
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;

-- Option 3: Delete by user ID (if you know the UUID)
-- Replace 'user-uuid-here' with the actual user ID
/*
DELETE FROM public.users WHERE id = 'user-uuid-here';
DELETE FROM auth.users WHERE id = 'user-uuid-here';
*/

-- Option 4: List all users to find the one you want to delete
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.username,
  p.elo_rating
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
ORDER BY u.created_at DESC;

