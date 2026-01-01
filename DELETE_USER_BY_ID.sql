-- Delete the specific user that's causing the duplicate key error
-- User ID from error: d1ea71e0-62a0-4553-bb80-dfbcd1000a56

-- Delete from public.users
DELETE FROM public.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- Delete from auth.users
DELETE FROM auth.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

-- Verify deletion (both should return 0)
SELECT COUNT(*) as remaining_in_public FROM public.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';
SELECT COUNT(*) as remaining_in_auth FROM auth.users WHERE id = 'd1ea71e0-62a0-4553-bb80-dfbcd1000a56';

