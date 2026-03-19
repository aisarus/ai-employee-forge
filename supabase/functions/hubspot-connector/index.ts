/**
 * hubspot-connector — Supabase Edge Function
 *
 * Creates and queries HubSpot CRM contacts / deals on behalf of a bot.
 * Auth: HubSpot Private App access token (Bearer).
 *
 * POST body:
 *   action:         "create_contact" | "search_contacts" | "update_contact" | "create_deal"
 *   properties?:    Record<string, string>  — HubSpot property key-value map
 *   contactId?:     string  — required for update_contact
 *   searchQuery?:   string  — email or name for search_contacts
 *   accessToken?:   string  — HubSpot Private App access token (explicit)
 *   agentId?:       string  — load token from bot_connectors table
 *
 * HubSpot contact properties reference:
 *   firstname, lastname, email, phone, company, jobtitle, website,
 *   city, country, hs_lead_status, lifecyclestage, notes_last_updated
 *
 * HubSpot deal properties reference:
 *   dealname, amount, dealstage, pipeline, closedate,
 *   hubspot_owner_id, description
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryDecrypt } from "../_shared/crypto.ts";

const HUBSPOT_API = "https://api.hubapi.com";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const isAllowed =
    (allowedOrigin !== "" && origin === allowedOrigin) ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("https://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// HubSpot API helper
// ---------------------------------------------------------------------------
async function hubspotRequest(
  path: string,
  method: string,
  token: string,
  body?: unknown,
): Promise<{ ok: boolean; data: unknown; status: number; error?: string }> {
  try {
    const res = await fetch(`${HUBSPOT_API}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data as any)?.message ??
        (data as any)?.error ??
        `HTTP ${res.status}`;
      return { ok: false, data: null, status: res.status, error: msg };
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    return { ok: false, data: null, status: 0, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Map flat key=value pairs to HubSpot property objects
// ---------------------------------------------------------------------------
function toHubSpotProperties(fields: Record<string, string>): Record<string, string> {
  // HubSpot CRM v3 expects { properties: { key: "value", ... } }
  // We pass through as-is; callers use standard HubSpot property names.
  return fields;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, cors, 405);

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: {
    action: string;
    properties?: Record<string, string>;
    contactId?: string;
    searchQuery?: string;
    accessToken?: string;
    agentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, cors, 400);
  }

  const { action, agentId, contactId, searchQuery } = body;
  let { properties, accessToken } = body;

  if (!action) return json({ error: "Missing: action" }, cors, 400);

  // ── Load credentials from DB when agentId provided ──────────────────────
  if (agentId && !accessToken) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await supabase
      .from("bot_connectors")
      .select("auth_value, config")
      .eq("agent_id", agentId)
      .eq("connector_type", "hubspot")
      .eq("status", "connected")
      .maybeSingle();

    if (row?.auth_value) {
      accessToken = await tryDecrypt(row.auth_value);
    }
  }

  if (!accessToken) {
    return json({ error: "No HubSpot token — provide accessToken or agentId" }, cors, 400);
  }

  // ── CREATE CONTACT ───────────────────────────────────────────────────────
  if (action === "create_contact") {
    if (!properties || typeof properties !== "object") {
      return json({ error: "properties (object) required for create_contact" }, cors, 400);
    }

    const result = await hubspotRequest(
      "/crm/v3/objects/contacts",
      "POST",
      accessToken,
      { properties: toHubSpotProperties(properties) },
    );

    if (!result.ok) {
      // 409 Conflict = contact already exists — return existing id
      if (result.status === 409) {
        const existingId = (result.data as any)?.message?.match(/ID: (\d+)/)?.[1] ?? null;
        return json({ success: false, alreadyExists: true, existingId, error: result.error }, cors, 409);
      }
      return json({ error: result.error }, cors, 502);
    }

    return json({
      success: true,
      contactId: (result.data as any)?.id,
      properties: (result.data as any)?.properties,
    }, cors);
  }

  // ── SEARCH CONTACTS ──────────────────────────────────────────────────────
  if (action === "search_contacts") {
    if (!searchQuery) {
      return json({ error: "searchQuery required for search_contacts" }, cors, 400);
    }

    const result = await hubspotRequest(
      "/crm/v3/objects/contacts/search",
      "POST",
      accessToken,
      {
        query: searchQuery,
        limit: 10,
        properties: ["firstname", "lastname", "email", "phone", "company", "hs_lead_status"],
      },
    );

    if (!result.ok) return json({ error: result.error }, cors, 502);

    const contacts = ((result.data as any)?.results ?? []).map((c: any) => ({
      id: c.id,
      properties: c.properties,
    }));

    return json({ success: true, contacts, total: contacts.length }, cors);
  }

  // ── UPDATE CONTACT ───────────────────────────────────────────────────────
  if (action === "update_contact") {
    if (!contactId) return json({ error: "contactId required for update_contact" }, cors, 400);
    if (!properties || typeof properties !== "object") {
      return json({ error: "properties (object) required for update_contact" }, cors, 400);
    }

    const result = await hubspotRequest(
      `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`,
      "PATCH",
      accessToken,
      { properties: toHubSpotProperties(properties) },
    );

    if (!result.ok) return json({ error: result.error }, cors, 502);

    return json({
      success: true,
      contactId: (result.data as any)?.id,
      properties: (result.data as any)?.properties,
    }, cors);
  }

  // ── CREATE DEAL ──────────────────────────────────────────────────────────
  if (action === "create_deal") {
    if (!properties || typeof properties !== "object") {
      return json({ error: "properties (object) required for create_deal" }, cors, 400);
    }

    // Ensure required deal fields have defaults
    const dealProps: Record<string, string> = {
      dealstage: "appointmentscheduled",
      pipeline: "default",
      ...toHubSpotProperties(properties),
    };

    const result = await hubspotRequest(
      "/crm/v3/objects/deals",
      "POST",
      accessToken,
      { properties: dealProps },
    );

    if (!result.ok) return json({ error: result.error }, cors, 502);

    return json({
      success: true,
      dealId: (result.data as any)?.id,
      properties: (result.data as any)?.properties,
    }, cors);
  }

  return json(
    { error: `Unknown action: ${action}. Use create_contact, search_contacts, update_contact, or create_deal.` },
    cors,
    400,
  );
});
