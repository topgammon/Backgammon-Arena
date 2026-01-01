-- ============================================
-- DELETE ALL USERS (FOR TESTING ONLY)
-- Run this in Supabase SQL Editor
-- WARNING: This will delete ALL users and related data!
-- ============================================

-- Step 1: Delete from dependent tables first (if they exist)
-- These tables reference users, so we need to delete their data first

-- Delete moves (references users)
DELETE FROM public.moves;

-- Delete tournament participants (references users)
DELETE FROM public.tournament_participants;

-- Delete games (references users)
DELETE FROM public.games;

-- Step 2: Delete from public.users
DELETE FROM public.users;

-- Step 3: Delete from auth.users (this is the actual auth table)
DELETE FROM auth.users;

-- Verify all users are deleted
SELECT COUNT(*) as remaining_users FROM auth.users;
SELECT COUNT(*) as remaining_profiles FROM public.users;

