-- Add welcome experience columns to bots table so the webhook can send
-- the configured welcome message + starter buttons on /start, and use
-- the custom fallback when the AI is unavailable.
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS welcome_message  text  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fallback_message text  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS starter_buttons  jsonb NOT NULL DEFAULT '[]';
