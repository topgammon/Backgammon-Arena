-- Add google_avatar_url column to users table for Google OAuth users
-- Run this in your Supabase SQL Editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS google_avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.users.google_avatar_url IS 'Google profile photo URL for OAuth users';

