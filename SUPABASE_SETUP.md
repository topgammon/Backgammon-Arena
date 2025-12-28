# 🗄️ Supabase Database Setup Guide

This guide will help you set up your Supabase database for Backgammon Arena.

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Click on your project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** (this is your `SUPABASE_URL`)
   - **anon public** key (this is your `SUPABASE_ANON_KEY`)
   - **service_role** key (this is your `SUPABASE_SERVICE_ROLE_KEY` - keep this secret!)

## Step 2: Set Up Environment Variables

### Backend (.env file)
Create `backend/.env`:
```
PORT=3001
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Frontend (.env file)
Create `frontend/.env`:
```
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 3: Create Database Tables

Run these SQL queries in your Supabase SQL Editor (Dashboard → SQL Editor):

### Users Table
```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT,
  elo_rating INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Games Table
```sql
-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES public.users(id),
  player2_id UUID REFERENCES public.users(id),
  game_type TEXT NOT NULL, -- 'offline', 'online', 'pass-and-play', 'bot'
  bot_difficulty INTEGER, -- 1-10 for bot games
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'resigned'
  winner_id UUID REFERENCES public.users(id),
  elo_stake INTEGER DEFAULT 1, -- Multiplier from doubling cube
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);
```

### Moves Table
```sql
-- Moves table (for game review/analysis)
CREATE TABLE public.moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player_id UUID REFERENCES public.users(id),
  move_data JSONB NOT NULL, -- Store move details as JSON
  position_before JSONB,
  position_after JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tournaments Table
```sql
-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'bracket', 'round-robin'
  status TEXT DEFAULT 'open', -- 'open', 'in-progress', 'completed'
  max_players INTEGER DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);
```

### Tournament Participants Table
```sql
-- Tournament participants
CREATE TABLE public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  position INTEGER, -- Final ranking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Step 4: Set Up Row Level Security (RLS)

Enable RLS and create policies:

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- Users: Anyone can read, users can update their own data
CREATE POLICY "Users are viewable by everyone" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Games: Anyone can read, users can create games
CREATE POLICY "Games are viewable by everyone" ON public.games
  FOR SELECT USING (true);

CREATE POLICY "Users can create games" ON public.games
  FOR INSERT WITH CHECK (true);

-- Moves: Anyone can read, users can create moves
CREATE POLICY "Moves are viewable by everyone" ON public.moves
  FOR SELECT USING (true);

CREATE POLICY "Users can create moves" ON public.moves
  FOR INSERT WITH CHECK (true);

-- Tournaments: Anyone can read and create
CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create tournaments" ON public.tournaments
  FOR INSERT WITH CHECK (true);
```

## Step 5: Test the Connection

Once you've set up your `.env` files, test the connection by starting your backend:

```bash
cd backend
npm run dev
```

You should see: `🚀 Backend server running on port 3001`

If you see a Supabase warning, double-check your environment variables.

---

**Next Steps:**
- Once the database is set up, we'll integrate it into the game logic
- We'll create API endpoints to interact with the database
- We'll set up real-time subscriptions for online play

