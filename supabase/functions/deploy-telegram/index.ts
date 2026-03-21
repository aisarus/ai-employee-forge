import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptValue } from "../_shared/crypto.ts";

const TELEGRAM_API = "https://api.telegram.org";

// ---------------------------------------------------------------------------
// DT2/S4: Restrict CORS to the configured frontend origin.
// Set the ALLOWED_ORIGIN env var to your Lovable/Vercel domain.
// localhost / 127.0.0.1 are always allowed for local development.
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
    "Access-Control-Allow-Origin": isAllowed ? origin : (allowedOrigin || "null"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const TELEGRAM_CALL_TIMEOUT_MS = 10_000;

function jsonResponse(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function callTelegram(
  token: string,
  method: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: any }> {
  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEGRAM_CALL_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Telegram ${method} network error:`, msg);
    return { ok: false, data: { description: `Network error: ${msg}` } };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Telegram ${method} failed:`, JSON.stringify(data));
    return { ok: false, data };
  }
  return { ok: data.ok, data };
}

function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Upload bot profile photo from a public URL via multipart/form-data (non-critical). */
async function setBotPhotoFromUrl(token: string, photoUrl: string): Promise<void> {
  try {
    const imgRes = await fetch(photoUrl, { signal: AbortSignal.timeout(8_000) });
    if (!imgRes.ok) {
      console.warn(`setMyPhoto: could not fetch avatar (${imgRes.status}):`, photoUrl);
      return;
    }
    const imgBlob = await imgRes.blob();
    const form = new FormData();
    form.append("photo", imgBlob, "avatar.jpg");
    const res = await fetch(`${TELEGRAM_API}/bot${token}/setMyPhoto`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TELEGRAM_CALL_TIMEOUT_MS),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("setMyPhoto failed (non-fatal):", JSON.stringify(data));
    } else {
      console.log("setMyPhoto: bot avatar set successfully.");
    }
  } catch (err) {
    console.warn("setMyPhoto error (non-fatal):", err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Authenticate caller ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const {
      agentId,
      telegramToken,
      openaiApiKey,
      displayName,
      shortDescription,
      aboutText,
      commands,
      welcomeMessage,
      fallbackMessage,
      starterButtons,
    } = await req.json();

    // ── Validate inputs ────────────────────────────────────────────────────
    if (!agentId) {
      return jsonResponse({ error: "agentId is required" }, 400, corsHeaders);
    }
    if (!telegramToken) {
      return jsonResponse({ error: "telegramToken is required" }, 400, corsHeaders);
    }

    // ── Verify agent belongs to this user ──────────────────────────────────
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return jsonResponse({ error: "Agent not found" }, 404, corsHeaders);
    }

    // ── 1. Validate token via getMe ────────────────────────────────────────
    const meResult = await callTelegram(telegramToken, "getMe", {});
    if (!meResult.ok) {
      const errData = meResult.data as { error_code?: number; description?: string };
      const tgCode = errData?.error_code;
      const errKey =
        tgCode === 401 ? "deploy_error.tg_unauthorized"
        : tgCode === 409 ? "deploy_error.tg_conflict"
        : tgCode === 429 ? "deploy_error.tg_rate_limit"
        : "deploy_error.tg_unknown";
      return jsonResponse({ error: errKey, details: errData?.description }, 400, corsHeaders);
    }
    const botInfo = (meResult.data as { result: unknown }).result;

    // ── 2. Configure bot metadata via Telegram API ─────────────────────────
    if (displayName) {
      await callTelegram(telegramToken, "setMyName", { name: displayName });
    }
    if (shortDescription) {
      await callTelegram(telegramToken, "setMyShortDescription", { short_description: shortDescription });
    }
    if (aboutText) {
      await callTelegram(telegramToken, "setMyDescription", { description: aboutText });
    }

    const normalizedCommands = Array.isArray(commands)
      ? commands
          .map((c: { command: string; description: string }) => ({
            command: c.command.replace(/^\/+/, "").toLowerCase().replace(/[^a-z0-9_]/g, ""),
            description: (c.description || c.command).slice(0, 256),
          }))
          .filter((c) => c.command.length >= 1 && c.command.length <= 32)
      : [];

    await callTelegram(telegramToken, "setMyCommands", { commands: normalizedCommands });
    await callTelegram(telegramToken, "setChatMenuButton", {
      menu_button: normalizedCommands.length > 0 ? { type: "commands" } : { type: "default" },
    });

    // ── 3. Upsert bot row in `bots` table ──────────────────────────────────
    const webhookSecret = generateWebhookSecret();

    const { data: agentFull } = await supabase
      .from("agents")
      .select("system_prompt, welcome_message, fallback_message, bot_avatar_url")
      .eq("id", agentId)
      .single();

    // DT7: Guard against blank system_prompt — deployed bot must have a personality
    const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Be concise and friendly.";
    const systemPrompt = agentFull?.system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT;
    if (!agentFull?.system_prompt?.trim()) {
      console.warn(`DT7: Agent ${agentId} has no system_prompt — using default.`);
    }

    // ── 2b. Set bot profile photo (non-critical, skip on any error) ────────
    const avatarUrl = agentFull?.bot_avatar_url?.trim();
    if (avatarUrl) {
      await setBotPhotoFromUrl(telegramToken, avatarUrl);
    }

    // S1/S2/DT1/DT6: Encrypt credentials before storing to DB
    const encryptedTelegramToken = await encryptValue(telegramToken);
    // Accept OpenAI (sk-), Anthropic (sk-ant-), and Gemini (AIza) keys
    const cleanOpenaiKey = openaiApiKey && (
      openaiApiKey.startsWith("sk-") ||
      openaiApiKey.startsWith("AIza")
    ) ? openaiApiKey.trim() : null;
    const encryptedOpenaiKey = cleanOpenaiKey ? await encryptValue(cleanOpenaiKey) : null;

    const botUpsertData: Record<string, unknown> = {
      user_id:          user.id,
      agent_id:         agentId,
      name:             displayName || (botInfo as { first_name?: string }).first_name || "",
      system_prompt:    systemPrompt,
      telegram_token:   encryptedTelegramToken,
      openai_api_key:   encryptedOpenaiKey,
      webhook_secret:   webhookSecret,
      is_active:        true,
      welcome_message:  welcomeMessage  ?? agentFull?.welcome_message  ?? "",
      fallback_message: fallbackMessage ?? agentFull?.fallback_message ?? "",
      starter_buttons:  Array.isArray(starterButtons) ? starterButtons : [],
    };

    const { data: botRow, error: botUpsertError } = await supabase
      .from("bots")
      .upsert(botUpsertData, { onConflict: "agent_id" })
      .select("id")
      .single();

    if (botUpsertError || !botRow) {
      console.error("Bot upsert error:", botUpsertError?.message);
      return jsonResponse(
        { error: "Failed to create bot record: " + (botUpsertError?.message ?? "unknown") },
        500, corsHeaders,
      );
    }

    const botId = botRow.id;

    // ── 4. Register Webhook with Telegram ─────────────────────────────────
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botId}`;

    const deleteResult = await callTelegram(telegramToken, "deleteWebhook", {
      drop_pending_updates: false,
    });
    if (!deleteResult.ok) {
      console.warn("deleteWebhook returned non-ok (continuing):", JSON.stringify(deleteResult.data));
    }

    // ── Helper: mark bot inactive in DB on webhook failure ────────────────
    async function rollbackBotActive(): Promise<void> {
      const { error: rbErr } = await supabase
        .from("bots")
        .update({ is_active: false })
        .eq("id", botId);
      if (rbErr) console.error("Rollback failed:", rbErr.message);
    }

    // ── Try setWebhook (with one retry on transient network errors) ────────
    let webhookResult = await callTelegram(telegramToken, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      max_connections: 40,
      allowed_updates: ["message", "edited_message", "callback_query", "channel_post"],
      drop_pending_updates: true,
    });

    if (!webhookResult.ok) {
      const errData = webhookResult.data as { description?: string };
      const desc = errData?.description ?? "";

      // DT3: "webhook was already set" — can happen in race conditions.
      // Delete and re-register with the NEW secret so there's no secret mismatch.
      if (desc.toLowerCase().includes("webhook was already set")) {
        console.warn("DT3: setWebhook — webhook already set, forcing re-registration with new secret.");
        await callTelegram(telegramToken, "deleteWebhook", { drop_pending_updates: true });
        webhookResult = await callTelegram(telegramToken, "setWebhook", {
          url: webhookUrl,
          secret_token: webhookSecret,
          max_connections: 40,
          allowed_updates: ["message", "edited_message", "callback_query", "channel_post"],
          drop_pending_updates: true,
        });
      }

      // If still failing — rollback bot to inactive and return error
      if (!webhookResult.ok) {
        console.error("setWebhook failed permanently:", JSON.stringify(webhookResult.data));
        await rollbackBotActive();
        return jsonResponse(
          {
            error: "deploy_error.webhook_failed",
            details: (webhookResult.data as { description?: string })?.description ?? "Telegram setWebhook rejected",
          },
          400, corsHeaders,
        );
      }
    }

    const webhookInfoResult = await callTelegram(telegramToken, "getWebhookInfo", {});
    const webhookInfo = webhookInfoResult.ok
      ? (webhookInfoResult.data as { result: unknown }).result
      : null;

    if (webhookInfo && (webhookInfo as { url?: string }).url !== webhookUrl) {
      console.error(
        "Webhook URL mismatch after setWebhook:",
        "expected:", webhookUrl,
        "got:", (webhookInfo as { url?: string }).url,
      );
      await rollbackBotActive();
      return jsonResponse(
        {
          error: "deploy_error.webhook_failed",
          details: `Webhook URL mismatch: Telegram reports "${(webhookInfo as { url?: string }).url}" but expected "${webhookUrl}"`,
        },
        500, corsHeaders,
      );
    }

    if ((webhookInfo as { last_error_message?: string })?.last_error_message) {
      console.warn("Telegram webhook last_error:", (webhookInfo as { last_error_message?: string }).last_error_message);
    }

    // ── 5. Persist agent metadata + activate ──────────────────────────────
    // S1: Encrypt openai_api_key before storing in agents table
    const agentUpdateData: Record<string, unknown> = {
      telegram_token:             encryptedTelegramToken,
      platform:                   "telegram",
      is_active:                  true,
      telegram_display_name:      displayName || null,
      telegram_short_description: shortDescription || null,
      telegram_about_text:        aboutText || null,
      telegram_commands:          Array.isArray(commands) ? commands : [],
      telegram_update_offset:     0, // Added based on remote's coreUpdate
    };
    if (encryptedOpenaiKey) {
      agentUpdateData.openai_api_key = encryptedOpenaiKey;
    }

    const { error: updateError } = await supabase
      .from("agents")
      .update(agentUpdateData)
      .eq("id", agentId);

    if (updateError) {
      return jsonResponse(
        { error: "Failed to update agent: " + updateError.message },
        500, corsHeaders,
      );
    }

    return jsonResponse(
      {
        success:     true,
        botInfo,
        botId,
        webhookUrl,
        webhookInfo,
        message:     `Bot @${(botInfo as { username?: string }).username} is now live! Webhook set to ${webhookUrl}`,
      },
      200, corsHeaders,
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("deploy-telegram error:", msg);
    return jsonResponse({ error: msg }, 500, corsHeaders);
  }
});
