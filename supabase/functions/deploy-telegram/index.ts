import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callTelegram(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Telegram ${method} failed:`, JSON.stringify(data));
  }
  return { ok: res.ok, data };
}

function generateWebhookSecret(): string {
  // Telegram accepts 1-256 chars: A-Z, a-z, 0-9, _ and -
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "agentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!telegramToken) {
      return new Response(JSON.stringify({ error: "telegramToken is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify agent belongs to this user ──────────────────────────────────
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .eq("user_id", user.id)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Validate token via getMe ────────────────────────────────────────
    const meResult = await callTelegram(telegramToken, "getMe", {});
    if (!meResult.ok) {
      const errData = meResult.data as any;
      const tgCode  = errData?.error_code;
      const errKey  = tgCode === 401 ? "deploy_error.tg_unauthorized"
                    : tgCode === 409 ? "deploy_error.tg_conflict"
                    : tgCode === 429 ? "deploy_error.tg_rate_limit"
                    : "deploy_error.tg_unknown";
      return new Response(JSON.stringify({ error: errKey, details: errData?.description }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const botInfo = (meResult.data as any).result;

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

    // Normalize commands: Telegram requires no leading slash and lowercase letters.
    // Strip "/" prefix that the wizard adds for display purposes, then lowercase.
    const normalizedCommands = Array.isArray(commands)
      ? commands
          .map((c: { command: string; description: string }) => ({
            command: c.command.replace(/^\/+/, "").toLowerCase().replace(/[^a-z0-9_]/g, ""),
            description: (c.description || c.command).slice(0, 256),
          }))
          .filter((c) => c.command.length >= 1 && c.command.length <= 32)
      : [];

    // Always call setMyCommands — even with an empty array — so that a
    // re-deploy with no commands correctly clears previously registered ones.
    await callTelegram(telegramToken, "setMyCommands", { commands: normalizedCommands });

    // Configure the bot's menu button: show the command list when there are
    // commands, otherwise hide it with a plain "default" button.
    await callTelegram(telegramToken, "setChatMenuButton", {
      menu_button: normalizedCommands.length > 0
        ? { type: "commands" }
        : { type: "default" },
    });

    // ── 3. Upsert bot row in `bots` table (webhook receiver) ──────────────
    const webhookSecret = generateWebhookSecret();

    // Fetch system_prompt and welcome experience fields from agents
    const { data: agentFull } = await supabase
      .from("agents")
      .select("system_prompt, welcome_message, fallback_message")
      .eq("id", agentId)
      .single();

    const botUpsertData: Record<string, unknown> = {
      user_id:          user.id,
      agent_id:         agentId,
      name:             displayName || botInfo.first_name || "",
      system_prompt:    agentFull?.system_prompt ?? "",
      telegram_token:   telegramToken,
      openai_api_key:   (openaiApiKey && openaiApiKey.startsWith("sk-")) ? openaiApiKey : null,
      webhook_secret:   webhookSecret,
      is_active:        true,
      // Welcome experience — prefer body params, fall back to what's saved in agents table
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
      return new Response(
        JSON.stringify({ error: "Failed to create bot record: " + (botUpsertError?.message ?? "unknown") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botId = botRow.id;

    // ── 4. Register Webhook with Telegram ─────────────────────────────────
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook/${botId}`;

    // 4a. Delete any pre-existing webhook so re-deploys start clean.
    //     We do NOT drop pending updates here — setWebhook will handle that.
    const deleteResult = await callTelegram(telegramToken, "deleteWebhook", {
      drop_pending_updates: false,
    });
    if (!deleteResult.ok) {
      // Non-fatal: log and continue — setWebhook will overwrite the old one.
      console.warn("deleteWebhook returned non-ok (continuing):", JSON.stringify(deleteResult.data));
    }

    // 4b. Register the new webhook.
    const webhookResult = await callTelegram(telegramToken, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });

    if (!webhookResult.ok) {
      const errData = webhookResult.data as any;
      console.error("setWebhook failed:", JSON.stringify(errData));
      return new Response(
        JSON.stringify({
          error: "deploy_error.webhook_failed",
          details: errData?.description ?? "Telegram setWebhook rejected",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4c. Verify the webhook was actually registered with the correct URL.
    const webhookInfoResult = await callTelegram(telegramToken, "getWebhookInfo", {});
    const webhookInfo = webhookInfoResult.ok
      ? (webhookInfoResult.data as any).result
      : null;

    if (webhookInfo && webhookInfo.url !== webhookUrl) {
      console.error(
        "Webhook URL mismatch after setWebhook:",
        "expected:", webhookUrl,
        "got:", webhookInfo.url
      );
      return new Response(
        JSON.stringify({
          error: "deploy_error.webhook_failed",
          details: `Webhook URL mismatch: Telegram reports "${webhookInfo.url}" but expected "${webhookUrl}"`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (webhookInfo?.last_error_message) {
      // Surface any last delivery error so the user knows the webhook URL
      // was set but Telegram had trouble reaching it recently.
      console.warn("Telegram webhook last_error:", webhookInfo.last_error_message);
    }

    // ── 5. Persist agent metadata + activate ──────────────────────────────
    const agentUpdateData: Record<string, unknown> = {
      telegram_token:            telegramToken,
      platform:                  "telegram",
      is_active:                 true,
      telegram_display_name:     displayName || null,
      telegram_short_description: shortDescription || null,
      telegram_about_text:       aboutText || null,
      telegram_commands:         Array.isArray(commands) ? commands : [],
    };
    if (openaiApiKey && openaiApiKey.startsWith("sk-")) {
      agentUpdateData.openai_api_key = openaiApiKey;
    }

    const { error: updateError } = await supabase
      .from("agents")
      .update(agentUpdateData)
      .eq("id", agentId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update agent: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success:      true,
        botInfo,
        botId,
        webhookUrl,
        webhookInfo,  // url, pending_update_count, last_error_message, etc.
        message:      `Bot @${botInfo.username} is now live! Webhook set to ${webhookUrl}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
