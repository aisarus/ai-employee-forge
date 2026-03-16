-- Performance indexes for common query patterns
-- All created with IF NOT EXISTS so this migration is safe to re-run.

-- agents: user dashboard and RLS lookups filter by user_id
CREATE INDEX IF NOT EXISTS idx_agents_user_id
  ON public.agents (user_id);

-- bot_chat_history: conversation context is loaded by (bot_id, chat_id) ordered
-- by created_at DESC (most recent first); bot_id is the FK to bots, which in
-- turn links to agents.  A secondary index on created_at alone speeds up
-- time-range queries (e.g. purging old history).
CREATE INDEX IF NOT EXISTS idx_bot_chat_history_agent_created
  ON public.bot_chat_history (bot_id, created_at DESC);

-- telegram_messages: message history and RLS checks use agent_id
CREATE INDEX IF NOT EXISTS idx_telegram_messages_agent_id
  ON public.telegram_messages (agent_id);
