/**
 * webhook-connector — Supabase Edge Function
 *
 * Accepts POST { agentId, webhookUrl, payload } and delivers the payload
 * to the target webhookUrl with up to 3 attempts using exponential backoff
 * (delays: 1 s → 2 s → 4 s between retries).
 *
 * On completion it logs the delivery status (connected / error) to the
 * bot_connectors row for the given agent.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// DT2/S4: Restrict CORS to configured frontend origin.
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const isAllowed =
    (allowedOrigin !== "" && origin === allowedOrigin) ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("https://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (allowedOrigin || "null"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Exponential back-off delays (ms) before each retry attempt. */
const BACKOFF_MS = [1_000, 2_000, 4_000];

function json(body: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, corsHeaders, 405);
  }

  // ── Parse & validate request body ────────────────────────────────────────
  let agentId: string, webhookUrl: string, payload: unknown;
  try {
    ({ agentId, webhookUrl, payload } = await req.json());
  } catch {
    return json({ error: "Invalid JSON body." }, corsHeaders, 400);
  }

  if (!agentId || typeof agentId !== "string") {
    return json({ error: "Missing or invalid field: agentId" }, corsHeaders, 400);
  }
  if (!webhookUrl || typeof webhookUrl !== "string") {
    return json({ error: "Missing or invalid field: webhookUrl" }, corsHeaders, 400);
  }
  if (payload === undefined || payload === null) {
    return json({ error: "Missing field: payload" }, corsHeaders, 400);
  }

  // Basic URL validation
  try {
    new URL(webhookUrl);
  } catch {
    return json({ error: "webhookUrl is not a valid URL." }, corsHeaders, 400);
  }

  // ── Supabase client (service-role for logging) ────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Delivery with retry + exponential backoff ─────────────────────────────
  let success = false;
  let lastError = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    // Wait before retrying (not before the very first attempt)
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      lastStatus = res.status;

      if (res.ok) {
        success = true;
        break;
      }

      const text = await res.text().catch(() => "");
      lastError = `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // ── Log delivery status to bot_connectors ────────────────────────────────
  await supabase
    .from("bot_connectors")
    .update({
      status: success ? "connected" : "error",
    })
    .eq("agent_id", agentId)
    .then(({ error }) => {
      if (error) {
        console.error("[webhook-connector] Failed to update bot_connectors:", error.message);
      }
    });

  // Also insert a delivery log entry using the config JSONB field of a
  // dedicated "webhook_delivery" connector type row if one exists.
  // (Best-effort — we never fail the response because of this.)
  await supabase.from("bot_connectors").upsert(
    {
      agent_id: agentId,
      // user_id will be inferred from the existing row via the service role
      connector_type: "webhook_delivery_log",
      display_name: "Webhook Delivery Log",
      status: success ? "connected" : "error",
      config: {
        last_delivery_at: new Date().toISOString(),
        last_webhook_url: webhookUrl,
        last_attempt_status: lastStatus,
        last_error: success ? null : lastError,
      },
    },
    { onConflict: "agent_id, connector_type", ignoreDuplicates: false },
  ).then(({ error }) => {
    if (error) {
      // Non-fatal — the upsert may fail if the unique constraint doesn't exist
      console.warn("[webhook-connector] Upsert log warning:", error.message);
    }
  });

  // ── Respond ───────────────────────────────────────────────────────────────
  if (!success) {
    return json(
      {
        error: `Webhook delivery failed after 3 attempts.`,
        lastError,
        lastHttpStatus: lastStatus || undefined,
      },
      corsHeaders,
      502,
    );
  }

  return json({ success: true, message: "Webhook delivered successfully." }, corsHeaders);
});
