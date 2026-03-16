/**
 * useConnectors — Supabase CRUD for bot_connectors table.
 *
 * The bot_connectors table is not yet in the generated types, so we use
 * `(supabase as any)` casts for all queries against it.
 */

import { supabase } from "@/integrations/supabase/client";
import { ConnectorConfig } from "@/components/wizard/types";
import { encryptKey, decryptKey } from "@/lib/crypto";

export function useConnectors() {
  async function saveConnectors(agentId: string, connectors: ConnectorConfig[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: delError } = await (supabase as any)
      .from("bot_connectors")
      .delete()
      .eq("agent_id", agentId);

    if (delError) {
      console.warn("[useConnectors] delete error:", delError.message);
    }

    if (connectors.length === 0) return;

    const rows = await Promise.all(
      connectors.map(async (c) => ({
        agent_id:       agentId,
        user_id:        user.id,
        connector_type: c.type,
        display_name:   c.display_name,
        status:         c.status,
        auth_value:     c.auth_value ? await encryptKey(c.auth_value) : null,
        capabilities:   c.capabilities,
        config:         (c.config ?? {}) as Record<string, string>,
      }))
    );

    const { error: insError } = await (supabase as any)
      .from("bot_connectors")
      .insert(rows);

    if (insError) {
      console.warn("[useConnectors] insert error:", insError.message);
    }
  }

  async function loadConnectors(agentId: string): Promise<ConnectorConfig[]> {
    const { data, error } = await (supabase as any)
      .from("bot_connectors")
      .select("*")
      .eq("agent_id", agentId);

    if (error || !data) return [];

    return Promise.all(
      (data as any[]).map(async (row: any) => {
        let auth_value = "";
        if (row.auth_value) {
          try {
            auth_value = await decryptKey(row.auth_value);
          } catch {
            auth_value = row.auth_value;
          }
        }
        return {
          id:           row.id,
          type:         row.connector_type,
          display_name: row.display_name,
          status:       row.status as ConnectorConfig["status"],
          auth_value,
          capabilities: (row.capabilities ?? []) as ("read" | "write")[],
          config:       (row.config ?? {}) as Record<string, string>,
        };
      })
    );
  }

  return { saveConnectors, loadConnectors };
}
