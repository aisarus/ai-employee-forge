/**
 * webhook-connector — Supabase Edge Function
 *
 * Delivers an outbound webhook POST to an external URL on behalf of a bot.
 *
 * Features:
 *   - Up to 3 attempts with exponential back-off (1 s → 2 s between retries)
 *   - Per-attempt timeout (10 s) via AbortSignal.timeout
 *   - Smart retry: skips permanent client errors (4xx except 408/429)
 *   - Optional HMAC-SHA256 request signing (X-Hub-Signature-256 header)
 *   - SSRF protection: blocks private/loopback/link-local hostnames
 *   - Payload size guard (≤ 1 MB serialised)
 *   - Delivery status + metadata logged to bot_connectors (webhook row only)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
/** Delays (ms) before attempt 2 and 3 — never applied before the first attempt. */
const RETRY_DELAYS_MS = [1_000, 2_000];
const ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_PAYLOAD_BYTES = 1_024 * 1_024; // 1 MB

// ── CORS ──────────────────────────────────────────────────────────────────────

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

function json(body: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── SSRF guard ────────────────────────────────────────────────────────────────
// Blocks well-known private / loopback / link-local address patterns.
// DNS resolution is not available in Edge Functions, so this is hostname-based.

const PRIVATE_HOST_RE = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,          // 127.0.0.0/8 loopback
  /^0\.0\.0\.0$/,
  /^::1$/,                          // IPv6 loopback
  /^10\.\d+\.\d+\.\d+$/,           // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.0.0/12
  /^192\.168\.\d+\.\d+$/,          // 192.168.0.0/16
  /^169\.254\.\d+\.\d+$/,          // 169.254.0.0/16 link-local / AWS metadata
  /^fd[0-9a-f]{2}:/i,              // IPv6 ULA (fd00::/8)
  /\.local$/i,                      // mDNS
  /^metadata\.google\.internal$/i, // GCP metadata service
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_RE.some((re) => re.test(hostname));
}

function validateWebhookUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "webhookUrl is not a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "webhookUrl must use http or https." };
  }
  if (isPrivateHost(url.hostname)) {
    return {
      ok: false,
      reason: "webhookUrl must not target a private, loopback, or link-local address.",
    };
  }
  return { ok: true, url };
}

// ── HMAC-SHA256 signing ───────────────────────────────────────────────────────

async function computeHmac(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

// ── Retry logic ───────────────────────────────────────────────────────────────

/**
 * Returns true for status codes that must NOT be retried.
 * 4xx (except 408 Request Timeout and 429 Too Many Requests) are permanent
 * client errors — retrying would just waste time and annoy the target server.
 */
function isPermanentError(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

interface DeliveryResult {
  success: boolean;
  attempts: number;
  lastHttpStatus: number | null;
  lastError: string | null;
}

async function deliverWithRetry(
  webhookUrl: string,
  bodyStr: string,
  secret?: string,
): Promise<DeliveryResult> {
  let lastHttpStatus: number | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Exponential back-off before each retry (not before the first attempt).
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "BotForge-Webhook/1.0",
      "X-BotForge-Attempt": String(attempt + 1),
    };

    // Attach HMAC signature when a secret is provided so the receiver can verify.
    if (secret) {
      headers["X-Hub-Signature-256"] = await computeHmac(bodyStr, secret);
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: bodyStr,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });

      lastHttpStatus = res.status;

      if (res.ok) {
        console.log(
          `[webhook-connector] Delivered on attempt ${attempt + 1} — HTTP ${res.status}`,
        );
        return { success: true, attempts: attempt + 1, lastHttpStatus, lastError: null };
      }

      const text = await res.text().catch(() => "");
      lastError = `HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`;
      console.warn(`[webhook-connector] Attempt ${attempt + 1} failed — ${lastError}`);

      if (isPermanentError(res.status)) {
        console.warn(
          `[webhook-connector] HTTP ${res.status} is a permanent error — aborting retries.`,
        );
        return {
          success: false,
          attempts: attempt + 1,
          lastHttpStatus,
          lastError,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      console.warn(`[webhook-connector] Attempt ${attempt + 1} network/timeout error — ${msg}`);
    }
  }

  return { success: false, attempts: MAX_ATTEMPTS, lastHttpStatus, lastError };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, cors, 405);
  }

  // ── Parse & validate request body ─────────────────────────────────────────
  let agentId: string;
  let webhookUrl: string;
  let payload: unknown;
  let webhookSecret: string | undefined;

  try {
    ({ agentId, webhookUrl, payload, webhookSecret } = await req.json());
  } catch {
    return json({ error: "Invalid JSON body." }, cors, 400);
  }

  if (!agentId || typeof agentId !== "string") {
    return json({ error: "Missing or invalid field: agentId" }, cors, 400);
  }
  if (!webhookUrl || typeof webhookUrl !== "string") {
    return json({ error: "Missing or invalid field: webhookUrl" }, cors, 400);
  }
  if (payload === undefined || payload === null) {
    return json({ error: "Missing field: payload" }, cors, 400);
  }

  // ── URL safety check ───────────────────────────────────────────────────────
  const urlCheck = validateWebhookUrl(webhookUrl);
  if (!urlCheck.ok) {
    return json({ error: urlCheck.reason }, cors, 400);
  }

  // ── Payload size guard ─────────────────────────────────────────────────────
  let bodyStr: string;
  try {
    bodyStr = JSON.stringify(payload);
  } catch {
    return json({ error: "Payload is not JSON-serialisable." }, cors, 400);
  }
  if (new TextEncoder().encode(bodyStr).length > MAX_PAYLOAD_BYTES) {
    return json({ error: "Payload exceeds the 1 MB limit." }, cors, 413);
  }

  // ── Supabase client (service-role for DB writes) ───────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Deliver ────────────────────────────────────────────────────────────────
  const secret =
    typeof webhookSecret === "string" && webhookSecret.length > 0 ? webhookSecret : undefined;

  const result = await deliverWithRetry(webhookUrl, bodyStr, secret);

  // ── Log delivery result to bot_connectors ──────────────────────────────────
  // Only update the 'webhook' connector row, not every connector for this agent.
  const logConfig: Record<string, unknown> = {
    last_delivery_at: new Date().toISOString(),
    last_webhook_url: webhookUrl,
    last_attempt_count: result.attempts,
    last_http_status: result.lastHttpStatus,
    last_error: result.lastError,
  };

  const { error: dbErr } = await supabase
    .from("bot_connectors")
    .update({
      status: result.success ? "connected" : "error",
      config: logConfig,
    })
    .eq("agent_id", agentId)
    .eq("connector_type", "webhook");

  if (dbErr) {
    // Non-fatal: response is not blocked by logging failures.
    console.error(
      "[webhook-connector] Failed to update bot_connectors:",
      dbErr.message,
    );
  } else {
    console.log(
      `[webhook-connector] bot_connectors updated — agent ${agentId}, success=${result.success}`,
    );
  }

  // ── Respond ────────────────────────────────────────────────────────────────
  if (!result.success) {
    console.error(
      `[webhook-connector] All ${result.attempts} attempt(s) failed for agent ${agentId}.`,
      `Last error: ${result.lastError}`,
    );
    return json(
      {
        error: `Webhook delivery failed after ${result.attempts} attempt(s).`,
        lastError: result.lastError,
        lastHttpStatus: result.lastHttpStatus ?? undefined,
        attempts: result.attempts,
      },
      cors,
      502,
    );
  }

  return json(
    {
      success: true,
      message: "Webhook delivered successfully.",
      attempts: result.attempts,
      httpStatus: result.lastHttpStatus,
    },
    cors,
  );
});
