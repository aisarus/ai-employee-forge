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
    if (Array.isArray(commands) && commands.length > 0) {
      await callTelegram(telegramToken, "setMyCommands", { commands });
    }

    // ── 3. Upsert bot row in `bots` table (webhook receiver) ──────────────
    const webhookSecret = generateWebhookSecret();

    const botUpsertData = {
      user_id:       user.id,
      agent_id:      agentId,
      name:          displayName || botInfo.first_name || "",
      system_prompt: "", // will be populated from agents.system_prompt below
      telegram_token: telegramToken,
      openai_api_key: (openaiApiKey && openaiApiKey.startsWith("sk-")) ? openaiApiKey : null,
      webhook_secret: webhookSecret,
      is_active:     true,
    };

    // Fetch system_prompt from agents for the bots row
    const { data: agentFull } = await supabase
      .from("agents")
      .select("system_prompt")
      .eq("id", agentId)
      .single();

    if (agentFull?.system_prompt) {
      botUpsertData.system_prompt = agentFull.system_prompt;
    }

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
        success:    true,
        botInfo,
        botId,
        webhookUrl,
        message:    `Bot @${botInfo.username} is now live! Webhook set to ${webhookUrl}`,
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
