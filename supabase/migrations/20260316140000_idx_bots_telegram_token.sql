-- DB1: Index on bots.telegram_token
-- telegram-webhook looks up the bot row by token on every incoming message.
-- Without this index every message triggers a full sequential scan on bots.
-- IF NOT EXISTS makes this migration safe to apply on top of existing schema.

CREATE INDEX IF NOT EXISTS idx_bots_telegram_token
  ON public.bots (telegram_token);
