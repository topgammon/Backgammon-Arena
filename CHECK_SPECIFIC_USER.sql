-- Check if this specific user ID exists anywhere
-- Replace the ID with the one from the error: d1ea71e0-62a0-4553-bb80-dfbcd1000a56

-- Check in auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- Check in public.users
SELECT id, username, email, created_at 
FROM public.users 
WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- If found in public.users, delete it:
DELETE FROM public.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- If found in auth.users, delete it:
DELETE FROM auth.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

