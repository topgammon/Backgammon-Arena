-- Find and delete user by the ID from the error
-- Error ID: d1ea71e0-62a0-4553-bb80-dfbcd1000a56

-- Check if it exists in public.users
SELECT * FROM public.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- Check if it exists in auth.users
SELECT * FROM auth.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- Delete from public.users if it exists
DELETE FROM public.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- Delete from auth.users if it exists
DELETE FROM auth.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- Verify deletion
SELECT COUNT(*) FROM public.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';
SELECT COUNT(*) FROM auth.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

