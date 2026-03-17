/**
 * google-sheets-connector — Supabase Edge Function
 *
 * Reads and writes Google Sheets data on behalf of a bot.
 *
 * POST body:
 *   action:        "read" | "append" | "update"
 *   spreadsheetId: string   (required)
 *   sheetName?:    string   (default "Sheet1")
 *   range?:        string   (A1 notation, e.g. "Sheet1!A1:Z100")
 *   values?:       string[][] (required for append / update)
 *   apiKey?:       string   (Google API key — public spreadsheets)
 *   accessToken?:  string   (OAuth2 access token)
 *   agentId?:      string   (load credentials from bot_connectors)
 *
 * If agentId is provided and no explicit credentials are given, the function
 * decrypts the stored auth_value from the bot_connectors table.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryDecrypt } from "../_shared/crypto.ts";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

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
// Google Sheets API helper
// ---------------------------------------------------------------------------
async function sheetsRequest(
  path: string,
  method: string,
  auth: { apiKey?: string; accessToken?: string },
  body?: unknown,
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const qs = auth.accessToken
    ? ""
    : `${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(auth.apiKey ?? "")}`;
  const url = `${SHEETS_API}${path}${qs}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth.accessToken) headers["Authorization"] = `Bearer ${auth.accessToken}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as any)?.error?.message ?? `HTTP ${res.status}`;
      return { ok: false, data: null, error: msg };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, data: null, error: (e as Error).message };
  }
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
    spreadsheetId?: string;
    sheetName?: string;
    range?: string;
    values?: string[][];
    apiKey?: string;
    accessToken?: string;
    agentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, cors, 400);
  }

  const { action, agentId } = body;
  let { spreadsheetId, sheetName, range, values, apiKey, accessToken } = body;

  if (!action) return json({ error: "Missing: action" }, cors, 400);

  // ── Load credentials from DB when agentId provided ──────────────────────
  if (agentId && !apiKey && !accessToken) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await supabase
      .from("bot_connectors")
      .select("auth_value, config")
      .eq("agent_id", agentId)
      .eq("connector_type", "google_sheets")
      .eq("status", "connected")
      .maybeSingle();

    if (row) {
      const decrypted = row.auth_value ? await tryDecrypt(row.auth_value) : "";
      const cfg = (row.config ?? {}) as Record<string, string>;

      if (cfg.auth_mode === "oauth") {
        accessToken = decrypted;
      } else {
        apiKey = decrypted;
      }

      // Fallback to stored spreadsheetId / sheetName from config if not given
      if (!spreadsheetId && cfg.spreadsheet_id) spreadsheetId = cfg.spreadsheet_id;
      if (!sheetName && cfg.sheet_name) sheetName = cfg.sheet_name;
    }
  }

  if (!spreadsheetId) return json({ error: "Missing: spreadsheetId" }, cors, 400);
  if (!apiKey && !accessToken) return json({ error: "No credentials — provide apiKey, accessToken, or agentId" }, cors, 400);

  const auth = { apiKey, accessToken };
  const sheet = sheetName || "Sheet1";
  const effectiveRange = range || `${sheet}!A1:Z1000`;

  // ── READ ─────────────────────────────────────────────────────────────────
  if (action === "read") {
    const result = await sheetsRequest(
      `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(effectiveRange)}`,
      "GET",
      auth,
    );
    if (!result.ok) return json({ error: result.error }, cors, 502);

    const rows = (result.data as any)?.values ?? [];
    return json({ success: true, rows, rowCount: rows.length }, cors);
  }

  // ── APPEND ───────────────────────────────────────────────────────────────
  if (action === "append") {
    if (!values || !Array.isArray(values)) {
      return json({ error: "values (string[][]) required for append" }, cors, 400);
    }
    const appendRange = range || `${sheet}!A1`;
    const result = await sheetsRequest(
      `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      "POST",
      auth,
      { values },
    );
    if (!result.ok) return json({ error: result.error }, cors, 502);
    return json({
      success: true,
      updatedRange: (result.data as any)?.updates?.updatedRange,
      updatedRows: (result.data as any)?.updates?.updatedRows,
    }, cors);
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────
  if (action === "update") {
    if (!values || !range) return json({ error: "values and range required for update" }, cors, 400);
    const result = await sheetsRequest(
      `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      "PUT",
      auth,
      { values },
    );
    if (!result.ok) return json({ error: result.error }, cors, 502);
    return json({ success: true }, cors);
  }

  return json({ error: `Unknown action: ${action}. Use read, append, or update.` }, cors, 400);
});
