# 🔍 Database Verification Guide

Use this guide to check if your Supabase database is set up correctly for the authentication and user system.

---

## Step 1: Check What Tables Exist

Go to your Supabase dashboard → **SQL Editor** and run:

```sql
-- Check all tables in public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected tables:**
- `users`
- `games`
- `moves`
- `tournaments`
- `tournament_participants`

---

## Step 2: Check Users Table Structure

Run this to see what columns exist in the `users` table:

```sql
-- Check users table columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` (UUID, PRIMARY KEY)
- `username` (TEXT, UNIQUE)
- `email` (TEXT)
- `country` (TEXT, DEFAULT 'US') ← **Make sure this exists!**
- `elo_rating` (INTEGER, DEFAULT 1000)
- `wins` (INTEGER, DEFAULT 0)
- `losses` (INTEGER, DEFAULT 0)
- `games_played` (INTEGER, DEFAULT 0) ← **Make sure this exists!**
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

---

## Step 3: Add Missing Columns

If the `country` or `games_played` columns are missing, run the migration script:

**Option 1: Run the complete migration script**
- See `DATABASE_MIGRATION.sql` file in the project root
- Copy and paste the entire script into Supabase SQL Editor
- This is the safest option - it checks if columns exist before adding them

**Option 2: Add columns manually**
```sql
-- Add country column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';

-- Add games_played column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;

-- Update existing users to have default values
UPDATE public.users SET country = 'US' WHERE country IS NULL;
UPDATE public.users SET games_played = 0 WHERE games_played IS NULL;
```

---

## Step 4: Check Row Level Security (RLS)

Check if RLS is enabled:

```sql
-- Check RLS status on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('users', 'games', 'moves', 'tournaments', 'tournament_participants');
```

**Expected:** All tables should have `rowsecurity = true`

---

## Step 5: Check RLS Policies

Check what policies exist:

```sql
-- Check all RLS policies
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
ORDER BY tablename, policyname;
```

**Expected policies for `users` table:**
- "Users are viewable by everyone" (SELECT)
- "Users can update their own data" (UPDATE)

---

## Step 6: Complete Setup Script (Run if Missing Anything)

If you're missing tables or columns, run this complete setup:

```sql
-- ============================================
-- COMPLETE DATABASE SETUP SCRIPT
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create Users Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT,
  country TEXT DEFAULT 'US',
  elo_rating INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add country column if table exists but column doesn't
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'country'
  ) THEN
    ALTER TABLE public.users ADD COLUMN country TEXT DEFAULT 'US';
  END IF;
END $$;

-- 2. Create Games Table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES public.users(id),
  player2_id UUID REFERENCES public.users(id),
  game_type TEXT NOT NULL,
  bot_difficulty INTEGER,
  status TEXT DEFAULT 'active',
  winner_id UUID REFERENCES public.users(id),
  elo_stake INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create Moves Table
CREATE TABLE IF NOT EXISTS public.moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player_id UUID REFERENCES public.users(id),
  move_data JSONB NOT NULL,
  position_before JSONB,
  position_after JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Tournaments Table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  max_players INTEGER DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Create Tournament Participants Table
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies for Users
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
CREATE POLICY "Users are viewable by everyone" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own profile (for signup)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 8. Create RLS Policies for Games
DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
CREATE POLICY "Games are viewable by everyone" ON public.games
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create games" ON public.games;
CREATE POLICY "Users can create games" ON public.games
  FOR INSERT WITH CHECK (true);

-- 9. Create RLS Policies for Moves
DROP POLICY IF EXISTS "Moves are viewable by everyone" ON public.moves;
CREATE POLICY "Moves are viewable by everyone" ON public.moves
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create moves" ON public.moves;
CREATE POLICY "Users can create moves" ON public.moves
  FOR INSERT WITH CHECK (true);

-- 10. Create RLS Policies for Tournaments
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON public.tournaments;
CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create tournaments" ON public.tournaments;
CREATE POLICY "Anyone can create tournaments" ON public.tournaments
  FOR INSERT WITH CHECK (true);
```

---

## Step 7: Quick Verification Test

After running the setup, test if you can insert a user (this will fail if RLS is blocking):

```sql
-- This should work if RLS is set up correctly
-- (You'll need to be authenticated to test this properly)
SELECT * FROM public.users LIMIT 1;
```

---

## Step 8: Check Authentication Setup

Make sure Supabase Auth is enabled:

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Make sure **Email** provider is enabled
3. Check **Settings** → Make sure "Enable email confirmations" is configured as you want

---

## Common Issues & Fixes

### Issue: "permission denied for table users"
**Fix:** Make sure RLS policies allow INSERT for authenticated users. The policy "Users can insert their own profile" should fix this.

### Issue: "column country does not exist"
**Fix:** Run the `ALTER TABLE` command from Step 3.

### Issue: "duplicate key value violates unique constraint"
**Fix:** This means username already exists. The signup form should handle this, but you can check:
```sql
SELECT username FROM public.users WHERE username = 'your_username';
```

### Issue: Tables don't exist
**Fix:** Run the complete setup script from Step 6.

---

## What You Need Right Now for Signup to Work

**Minimum required:**
1. ✅ `users` table exists
2. ✅ `users` table has: `id`, `username`, `email`, `country`, `elo_rating`, `wins`, `losses`
3. ✅ RLS is enabled on `users` table
4. ✅ RLS policy allows INSERT for authenticated users
5. ✅ RLS policy allows SELECT for everyone
6. ✅ RLS policy allows UPDATE for own user

**Optional (for later features):**
- `games` table
- `moves` table
- `tournaments` table
- `tournament_participants` table

---

## Next Steps After Verification

1. ✅ Run the verification queries above
2. ✅ Fix any missing columns/tables
3. ✅ Test signup in your app
4. ✅ Check browser console for any errors
5. ✅ Verify user appears in Supabase dashboard → **Table Editor** → `users`

---

**Once everything is verified, your signup should work! 🎉**

