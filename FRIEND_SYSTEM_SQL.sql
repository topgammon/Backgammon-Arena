-- Friend System Database Tables
-- Run this SQL in your Supabase SQL Editor

-- Friend Requests Table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- Friends Table (stores accepted friendships)
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensures consistent ordering (smaller ID first)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON public.friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON public.friend_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);
CREATE INDEX IF NOT EXISTS idx_friends_user1 ON public.friends(user1_id);
CREATE INDEX IF NOT EXISTS idx_friends_user2 ON public.friends(user2_id);

-- Enable Row Level Security
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friend_requests
-- Users can view requests where they are the sender or recipient
CREATE POLICY "Users can view their own friend requests" ON public.friend_requests
  FOR SELECT USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

-- Users can create friend requests (send requests)
CREATE POLICY "Users can send friend requests" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- Users can update requests they received (accept/decline)
CREATE POLICY "Users can update received friend requests" ON public.friend_requests
  FOR UPDATE USING (auth.uid() = to_user_id);

-- Users can delete their own sent requests
CREATE POLICY "Users can delete their sent friend requests" ON public.friend_requests
  FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- RLS Policies for friends
-- Users can view friendships they are part of
CREATE POLICY "Users can view their friendships" ON public.friends
  FOR SELECT USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- Users can create friendships (when accepting a request)
CREATE POLICY "Users can create friendships" ON public.friends
  FOR INSERT WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- Users can delete their own friendships
CREATE POLICY "Users can delete their friendships" ON public.friends
  FOR DELETE USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- Add comments for documentation
COMMENT ON TABLE public.friend_requests IS 'Stores pending, accepted, and declined friend requests';
COMMENT ON TABLE public.friends IS 'Stores accepted friendships between users';
COMMENT ON COLUMN public.friend_requests.status IS 'Status: pending, accepted, or declined';
COMMENT ON COLUMN public.friends.user1_id IS 'Always the user with the smaller UUID';
COMMENT ON COLUMN public.friends.user2_id IS 'Always the user with the larger UUID';

