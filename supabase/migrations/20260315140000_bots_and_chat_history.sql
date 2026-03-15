-- bots: BYOK bot configurations with Telegram webhook support
CREATE TABLE public.bots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL DEFAULT '',
  system_prompt  text        NOT NULL DEFAULT '',
  telegram_token text        NOT NULL DEFAULT '',
  openai_api_key text        DEFAULT NULL,   -- BYOK key; NULL = use platform default
  webhook_secret text        DEFAULT NULL,   -- set on the Telegram webhook for verification
  is_active      boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bots: owner full access"
  ON public.bots FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep updated_at fresh automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER bots_updated_at
  BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------
-- bot_chat_history: role-based conversation context per (bot, chat)
-- Replaces the synthetic-ID hack used in telegram_messages for bot replies.
-- -----------------------------------------------------------------------
CREATE TABLE public.bot_chat_history (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id             uuid        NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  chat_id            bigint      NOT NULL,
  role               text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content            text        NOT NULL DEFAULT '',
  telegram_update_id bigint      DEFAULT NULL,  -- Telegram update_id for user messages
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: newest messages first for a given bot+chat
CREATE INDEX bot_chat_history_lookup
  ON public.bot_chat_history (bot_id, chat_id, created_at DESC);

ALTER TABLE public.bot_chat_history ENABLE ROW LEVEL SECURITY;

-- Access via the parent bot's ownership
CREATE POLICY "bot_chat_history: owner access"
  ON public.bot_chat_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = bot_chat_history.bot_id
        AND bots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bots
      WHERE bots.id = bot_chat_history.bot_id
        AND bots.user_id = auth.uid()
    )
  );
