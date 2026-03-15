-- Магистраль 3: bot_connectors table
-- Stores connector configurations per agent (Google Sheets, Airtable, etc.)

CREATE TABLE IF NOT EXISTS bot_connectors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  -- auth_value stored as-is for now; in production encrypt at rest
  auth_value TEXT,
  capabilities TEXT[] DEFAULT '{}',
  -- type-specific config: e.g. { spreadsheet_id, sheet_name, range } for Google Sheets
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_connectors_agent_id ON bot_connectors(agent_id);
CREATE INDEX IF NOT EXISTS idx_bot_connectors_user_id  ON bot_connectors(user_id);

ALTER TABLE bot_connectors ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify connectors that belong to them
CREATE POLICY "Users manage own bot connectors"
  ON bot_connectors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_bot_connectors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bot_connectors_updated_at
  BEFORE UPDATE ON bot_connectors
  FOR EACH ROW EXECUTE FUNCTION update_bot_connectors_updated_at();
