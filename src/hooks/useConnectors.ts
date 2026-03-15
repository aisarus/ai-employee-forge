/**
 * useConnectors — Supabase CRUD for bot_connectors table.
 *
 * Usage:
 *   const { saveConnectors, loadConnectors } = useConnectors();
 *
 * `saveConnectors` upserts all connectors for an agent in a single batch.
 * `loadConnectors` returns the stored connectors for an agent.
 *
 * Auth values are stored as-is; in a production environment you should
 * encrypt them server-side (e.g. via a Supabase Edge Function) before
 * persisting, and decrypt on read.
 */

import { supabase } from "@/integrations/supabase/client";
import { ConnectorConfig } from "@/components/wizard/types";

export function useConnectors() {
  /**
   * Persist all connectors for the given agent.
   * Deletes removed connectors and upserts current ones.
   */
  async function saveConnectors(agentId: string, connectors: ConnectorConfig[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Delete all existing connectors for this agent (simple replace strategy)
    const { error: delError } = await supabase
      .from("bot_connectors")
      .delete()
      .eq("agent_id", agentId);

    if (delError) {
      console.warn("[useConnectors] delete error:", delError.message);
    }

    if (connectors.length === 0) return;

    // 2. Insert new set
    const rows = connectors.map((c) => ({
      agent_id:       agentId,
      user_id:        user.id,
      connector_type: c.type,
      display_name:   c.display_name,
      status:         c.status,
      auth_value:     c.auth_value || null,
      capabilities:   c.capabilities,
      config:         (c.config ?? {}) as Record<string, string>,
    }));

    const { error: insError } = await supabase
      .from("bot_connectors")
      .insert(rows);

    if (insError) {
      console.warn("[useConnectors] insert error:", insError.message);
    }
  }

  /**
   * Load connectors for a given agent and map them to ConnectorConfig[].
   */
  async function loadConnectors(agentId: string): Promise<ConnectorConfig[]> {
    const { data, error } = await supabase
      .from("bot_connectors")
      .select("*")
      .eq("agent_id", agentId);

    if (error || !data) return [];

    return data.map((row) => ({
      id:           row.id,
      type:         row.connector_type,
      display_name: row.display_name,
      status:       row.status as ConnectorConfig["status"],
      auth_value:   row.auth_value ?? "",
      capabilities: (row.capabilities ?? []) as ("read" | "write")[],
      config:       (row.config ?? {}) as Record<string, string>,
    }));
  }

  return { saveConnectors, loadConnectors };
}
