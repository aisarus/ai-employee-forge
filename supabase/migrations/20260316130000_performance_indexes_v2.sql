-- Performance indexes — Sprint 3
-- Covers the remaining hot query paths not addressed in 20260316120000.
-- All use IF NOT EXISTS so the migration is safe to re-run.

-- -----------------------------------------------------------------------
-- bots: user_id
-- Used by every RLS policy and by the "My Bots" dashboard query.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bots_user_id
  ON public.bots (user_id);

-- -----------------------------------------------------------------------
-- bots: telegram_token
-- deploy-telegram looks bots up by token when validating re-deploys;
-- also used by support tooling to find which bot owns a given token.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bots_telegram_token
  ON public.bots (telegram_token);

-- -----------------------------------------------------------------------
-- bot_chat_history: (bot_id, telegram_update_id)
-- Deduplication check in the webhook handler:
--   SELECT id FROM bot_chat_history
--   WHERE bot_id = $1 AND telegram_update_id = $2
-- Without this index that query does a sequential scan on every message.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bot_chat_history_dedup
  ON public.bot_chat_history (bot_id, telegram_update_id)
  WHERE telegram_update_id IS NOT NULL;
