/**
 * notion-connector — Supabase Edge Function
 *
 * Reads and writes Notion database data on behalf of a bot.
 * Uses a Notion Internal Integration Token for auth.
 *
 * POST body:
 *   action:             "query" | "create_page" | "update_page"
 *   databaseId?:        string  (required for query / create_page)
 *   pageId?:            string  (required for update_page)
 *   filter?:            object  (Notion filter object for query)
 *   sorts?:             array   (Notion sorts array for query)
 *   pageSize?:          number  (max results for query, default 10)
 *   properties?:        object  (Notion property values for create_page / update_page)
 *   integrationToken?:  string  (Notion Internal Integration secret)
 *   agentId?:           string  (load token from bot_connectors)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryDecrypt } from "../_shared/crypto.ts";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

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
// Notion API helper
// ---------------------------------------------------------------------------
async function notionRequest(
  path: string,
  method: string,
  token: string,
  body?: unknown,
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  try {
    const res = await fetch(`${NOTION_API}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as any)?.message ?? `HTTP ${res.status}`;
      return { ok: false, data: null, error: msg };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, data: null, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Flatten Notion page properties to a simple key-value object
// ---------------------------------------------------------------------------
function flattenNotionProperties(props: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(props)) {
    const p = val as Record<string, unknown>;
    if (!p) continue;
    if (p.type === "title" && Array.isArray(p.title)) {
      out[key] = (p.title as any[]).map((t: any) => t?.plain_text ?? "").join("");
    } else if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
      out[key] = (p.rich_text as any[]).map((t: any) => t?.plain_text ?? "").join("");
    } else if (p.type === "select" && (p.select as any)?.name) {
      out[key] = (p.select as any).name;
    } else if (p.type === "multi_select" && Array.isArray(p.multi_select)) {
      out[key] = (p.multi_select as any[]).map((s: any) => s.name).join(", ");
    } else if (p.type === "number") {
      out[key] = p.number != null ? String(p.number) : "";
    } else if (p.type === "date" && (p.date as any)?.start) {
      out[key] = (p.date as any).start;
    } else if (p.type === "checkbox") {
      out[key] = String(p.checkbox);
    } else if (p.type === "email") {
      out[key] = (p.email as string) ?? "";
    } else if (p.type === "phone_number") {
      out[key] = (p.phone_number as string) ?? "";
    } else if (p.type === "url") {
      out[key] = (p.url as string) ?? "";
    }
  }
  return out;
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
    databaseId?: string;
    pageId?: string;
    filter?: unknown;
    sorts?: unknown[];
    pageSize?: number;
    properties?: Record<string, unknown>;
    integrationToken?: string;
    agentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, cors, 400);
  }

  const { action, agentId, databaseId, pageId, filter, sorts, pageSize, properties } = body;
  let { integrationToken } = body;

  if (!action) return json({ error: "Missing: action" }, cors, 400);

  // ── Load credentials from DB when agentId provided ──────────────────────
  if (agentId && !integrationToken) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await supabase
      .from("bot_connectors")
      .select("auth_value, config")
      .eq("agent_id", agentId)
      .eq("connector_type", "notion")
      .eq("status", "connected")
      .maybeSingle();

    if (row?.auth_value) {
      integrationToken = await tryDecrypt(row.auth_value);
    }
  }

  if (!integrationToken) {
    return json({ error: "No Notion token — provide integrationToken or agentId" }, cors, 400);
  }

  // ── QUERY DATABASE ───────────────────────────────────────────────────────
  if (action === "query") {
    if (!databaseId) return json({ error: "Missing: databaseId" }, cors, 400);

    const queryBody: Record<string, unknown> = {
      page_size: Math.min(pageSize ?? 10, 100),
    };
    if (filter) queryBody.filter = filter;
    if (sorts) queryBody.sorts = sorts;

    const result = await notionRequest(
      `/databases/${encodeURIComponent(databaseId)}/query`,
      "POST",
      integrationToken,
      queryBody,
    );
    if (!result.ok) return json({ error: result.error }, cors, 502);

    const pages = (result.data as any)?.results ?? [];
    const results = pages.map((page: any) => ({
      id: page.id,
      url: page.url,
      createdAt: page.created_time,
      properties: flattenNotionProperties(page.properties ?? {}),
    }));

    return json({ success: true, results, total: results.length }, cors);
  }

  // ── CREATE PAGE ──────────────────────────────────────────────────────────
  if (action === "create_page") {
    if (!databaseId) return json({ error: "Missing: databaseId" }, cors, 400);
    if (!properties || typeof properties !== "object") {
      return json({ error: "properties (object) required for create_page" }, cors, 400);
    }

    const result = await notionRequest("/pages", "POST", integrationToken, {
      parent: { database_id: databaseId },
      properties,
    });
    if (!result.ok) return json({ error: result.error }, cors, 502);

    return json({
      success: true,
      pageId: (result.data as any)?.id,
      url: (result.data as any)?.url,
    }, cors);
  }

  // ── UPDATE PAGE ──────────────────────────────────────────────────────────
  if (action === "update_page") {
    if (!pageId) return json({ error: "Missing: pageId" }, cors, 400);
    if (!properties || typeof properties !== "object") {
      return json({ error: "properties (object) required for update_page" }, cors, 400);
    }

    const result = await notionRequest(
      `/pages/${encodeURIComponent(pageId)}`,
      "PATCH",
      integrationToken,
      { properties },
    );
    if (!result.ok) return json({ error: result.error }, cors, 502);

    return json({ success: true, pageId: (result.data as any)?.id }, cors);
  }

  return json({ error: `Unknown action: ${action}. Use query, create_page, or update_page.` }, cors, 400);
});
