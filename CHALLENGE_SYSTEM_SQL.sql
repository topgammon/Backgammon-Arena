-- Challenge System Database Tables
-- Run this SQL in your Supabase SQL Editor

-- Add message_type column to messages table (if not exists)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'challenge'));

-- Add challenge_id column to messages table for challenge messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL;

-- Challenges Table
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  challenged_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  match_id UUID, -- Will be set when challenge is accepted and match is created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'), -- Challenges expire after 5 minutes
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(message_id) -- One challenge per message
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON public.challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON public.challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires_at ON public.challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_challenges_conversation ON public.challenges(conversation_id);

-- Enable Row Level Security
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for challenges
-- Users can view challenges they are involved in
CREATE POLICY "Users can view their challenges" ON public.challenges
  FOR SELECT USING (
    auth.uid() = challenger_id OR auth.uid() = challenged_id
  );

-- Users can create challenges (as challenger)
CREATE POLICY "Users can create challenges" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);

-- Users can update challenges they received (accept/decline)
CREATE POLICY "Users can update received challenges" ON public.challenges
  FOR UPDATE USING (auth.uid() = challenged_id);

-- Add comments for documentation
COMMENT ON TABLE public.challenges IS 'Stores challenge requests between users';
COMMENT ON COLUMN public.challenges.status IS 'pending, accepted, declined, or expired';
COMMENT ON COLUMN public.challenges.expires_at IS 'Challenges expire after 5 minutes if not responded to';

-- Function to automatically expire old challenges
CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.challenges
  SET status = 'expired', responded_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION expire_old_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_challenges() TO anon;

