
-- Singleton table to track the getUpdates offset
CREATE TABLE public.telegram_bot_state (
  id INT PRIMARY KEY CHECK (id = 1),
  update_offset BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Table for storing incoming messages
CREATE TABLE public.telegram_messages (
  update_id BIGINT PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  text TEXT,
  raw_update JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages(chat_id);
CREATE INDEX idx_telegram_messages_agent_id ON public.telegram_messages(agent_id);

-- RLS: only service_role can access bot state
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own agents' messages
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their agents"
  ON public.telegram_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agents
      WHERE agents.id = telegram_messages.agent_id
      AND agents.user_id = auth.uid()
    )
  );
