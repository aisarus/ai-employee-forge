-- connector_leads: audit log for every lead/record dispatched via a connector.
-- Enables dashboard analytics ("Your bot sent 12 leads to Google Sheets this week")
-- and replay / debugging of failed submissions.

CREATE TABLE IF NOT EXISTS connector_leads (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id           UUID        REFERENCES bots(id)           ON DELETE CASCADE,
  agent_id         UUID        REFERENCES agents(id)         ON DELETE CASCADE,
  -- connector_id may become NULL if the connector is later deleted
  connector_id     UUID        REFERENCES bot_connectors(id) ON DELETE SET NULL,
  connector_type   TEXT        NOT NULL,          -- 'google_sheets' | 'notion' | 'hubspot' | 'airtable' | 'webhook'
  telegram_chat_id BIGINT,                        -- Telegram chat_id the lead originated from
  fields           JSONB       NOT NULL DEFAULT '{}',  -- flat key→value map of the captured data
  status           TEXT        NOT NULL DEFAULT 'sent'
                               CHECK (status IN ('sent', 'failed', 'pending')),
  error_message    TEXT,                          -- populated on status='failed'
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Lookups by agent / bot / connector for dashboard widgets
CREATE INDEX idx_connector_leads_agent_id       ON connector_leads(agent_id);
CREATE INDEX idx_connector_leads_bot_id         ON connector_leads(bot_id);
CREATE INDEX idx_connector_leads_connector_id   ON connector_leads(connector_id);
-- Filter by type (e.g. "all Google Sheets leads")
CREATE INDEX idx_connector_leads_connector_type ON connector_leads(connector_type);
-- Time-series queries ("leads this week") — most recent first
CREATE INDEX idx_connector_leads_created_at     ON connector_leads(created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE connector_leads ENABLE ROW LEVEL SECURITY;

-- Users may only read their own leads (via owning the bot or agent)
CREATE POLICY "Users read own connector leads"
  ON connector_leads FOR SELECT
  USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
    OR
    bot_id   IN (SELECT id FROM bots   WHERE user_id = auth.uid())
  );

-- Inserts come exclusively from edge functions using the service-role key,
-- which bypasses RLS, so no INSERT policy is required for normal clients.
