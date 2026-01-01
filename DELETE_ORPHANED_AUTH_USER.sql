-- ============================================
-- DELETE ORPHANED AUTH USER
-- Use this to delete a user from auth.users that doesn't have a profile
-- ============================================

-- Step 1: Find users in auth.users that don't have profiles in public.users
SELECT 
    a.id,
    a.email,
    a.created_at,
    a.raw_user_meta_data->>'username' as username_from_metadata
FROM auth.users a
LEFT JOIN public.users p ON a.id = p.id
WHERE p.id IS NULL
ORDER BY a.created_at DESC;

-- Step 2: Delete a specific user by email (replace with the email you see)
DO $$
DECLARE
  user_id_to_delete UUID;
BEGIN
  -- Find user by email (REPLACE 'user@example.com' with the actual email)
  SELECT id INTO user_id_to_delete
  FROM auth.users
  WHERE email = 'user@example.com'; -- REPLACE WITH ACTUAL EMAIL
  
  IF user_id_to_delete IS NOT NULL THEN
    -- Delete from public.users first (if exists - shouldn't, but just in case)
    DELETE FROM public.users WHERE id = user_id_to_delete;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    
    RAISE NOTICE 'User deleted successfully';
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;

-- OR Step 2 Alternative: Delete ALL orphaned auth users (no profiles)
-- WARNING: This will delete ALL users in auth.users that don't have profiles
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT a.id
    FROM auth.users a
    LEFT JOIN public.users p ON a.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Delete from public.users first (if exists)
    DELETE FROM public.users WHERE id = user_record.id;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = user_record.id;
    
    RAISE NOTICE 'Deleted orphaned user: %', user_record.id;
  END LOOP;
END $$;

-- Step 3: Verify cleanup
SELECT COUNT(*) as orphaned_auth_users 
FROM auth.users a
LEFT JOIN public.users p ON a.id = p.id
WHERE p.id IS NULL;
-- Should return 0 if cleanup was successful

