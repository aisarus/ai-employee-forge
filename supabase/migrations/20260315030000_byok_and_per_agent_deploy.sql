-- BYOK: add openai_api_key per agent (stored as text; RLS protects it)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS openai_api_key text DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_update_offset bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bot_type text DEFAULT '';

-- Per-agent state replaces the global telegram_bot_state table.
-- Keep telegram_bot_state for backward compat but agents now track their own offset.
