-- ============================================
-- CLEAN UP ORPHANED USER RECORDS
-- This removes any records in public.users that don't have
-- a corresponding record in auth.users
-- ============================================

-- Step 1: Check for orphaned records (users in public.users but not in auth.users)
SELECT 
    p.id,
    p.username,
    p.email,
    p.created_at
FROM public.users p
LEFT JOIN auth.users a ON p.id = a.id
WHERE a.id IS NULL;

-- Step 2: If the query above returns any rows, delete those orphaned records
DELETE FROM public.users
WHERE id NOT IN (SELECT id FROM auth.users);

-- Step 3: Also delete from dependent tables for safety
DELETE FROM public.moves
WHERE player_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.tournament_participants
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.games
WHERE player1_id NOT IN (SELECT id FROM auth.users)
   OR player2_id NOT IN (SELECT id FROM auth.users);

-- Step 4: Verify cleanup
SELECT COUNT(*) as orphaned_users FROM public.users
WHERE id NOT IN (SELECT id FROM auth.users);

-- Should return 0 if cleanup was successful

