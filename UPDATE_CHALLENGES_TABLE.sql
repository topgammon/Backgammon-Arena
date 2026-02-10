-- Update challenges table to make conversation_id and message_id nullable
-- Since challenges are now sent via overlay instead of messages

-- Make conversation_id nullable
ALTER TABLE public.challenges 
ALTER COLUMN conversation_id DROP NOT NULL;

-- Make message_id nullable
ALTER TABLE public.challenges 
ALTER COLUMN message_id DROP NOT NULL;

-- Optional: Add a comment explaining the change
COMMENT ON COLUMN public.challenges.conversation_id IS 'Optional - challenges can be sent without conversations (overlay system)';
COMMENT ON COLUMN public.challenges.message_id IS 'Optional - challenges are no longer sent as messages';

