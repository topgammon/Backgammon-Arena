-- ============================================
-- FIX RLS POLICY FOR USER SIGNUP
-- Run this in Supabase SQL Editor
-- ============================================

-- First, check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY policyname;

-- Drop existing INSERT policy if it exists (to recreate it)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

-- Create INSERT policy that allows users to create their own profile
CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND cmd = 'INSERT';

