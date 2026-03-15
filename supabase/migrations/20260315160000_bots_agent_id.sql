-- Link bots rows back to the agents table for upsert during deploy
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

-- Enforce one bot per agent
CREATE UNIQUE INDEX IF NOT EXISTS bots_agent_id_unique
  ON public.bots (agent_id) WHERE agent_id IS NOT NULL;
