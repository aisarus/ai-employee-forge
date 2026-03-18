-- Sprint 3 Performance: additional indexes for hot query paths
-- All use IF NOT EXISTS so this migration is safe to re-run.

-- -----------------------------------------------------------------------
-- agents: telegram_token
-- telegram-poll scans agents by (platform, is_active) and then resolves
-- the token; an index on telegram_token helps identity lookups and any
-- future query that filters agents by token directly.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agents_telegram_token
  ON public.agents (telegram_token)
  WHERE telegram_token IS NOT NULL;

-- -----------------------------------------------------------------------
-- agents: (platform, is_active)
-- telegram-poll loads all active Telegram agents on every poll cycle:
--   SELECT * FROM agents WHERE platform = 'telegram' AND is_active = true
-- Without this index the query is a full sequential scan on agents.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agents_platform_active
  ON public.agents (platform, is_active)
  WHERE is_active = true;

-- -----------------------------------------------------------------------
-- telegram_messages: (agent_id, chat_id)
-- telegram-poll fetches conversation history per (agent, chat):
--   SELECT text, raw_update FROM telegram_messages
--   WHERE agent_id = $1 AND chat_id = $2 ORDER BY created_at ASC
-- A compound index avoids the secondary filter scan on chat_id.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_telegram_messages_agent_chat
  ON public.telegram_messages (agent_id, chat_id, created_at ASC);
