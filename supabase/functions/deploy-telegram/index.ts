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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      agentId,
      telegramToken,
      openaiApiKey,
      displayName,
      shortDescription,
      aboutText,
      commands,
    } = await req.json();

    // ── Validate inputs ──────────────────────────────────────────────────────
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
    if (!openaiApiKey || !openaiApiKey.startsWith("sk-")) {
      return new Response(JSON.stringify({ error: "deploy_error.openai_key_invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate OpenAI key early by calling models list (lightweight)
    const openaiCheck = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${openaiApiKey}` },
    });
    if (!openaiCheck.ok) {
      const oc = await openaiCheck.json().catch(() => ({})) as any;
      const errKey = openaiCheck.status === 401 ? "deploy_error.openai_unauthorized"
                   : openaiCheck.status === 429 ? "deploy_error.openai_rate_limit"
                   : "deploy_error.openai_unknown";
      return new Response(JSON.stringify({ error: errKey, details: oc?.error?.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify agent exists ──────────────────────────────────────────────────
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Validate token via getMe ──────────────────────────────────────────
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

    // ── 2. Configure bot via Telegram API ────────────────────────────────────
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

    // ── 3. Persist token + activate agent (schema-compatible) ────────────────
    let updateError: { message: string } | null = null;

    // Try extended schema first (projects with per-agent OpenAI key + offset)
    {
      const { error } = await supabase
        .from("agents")
        .update({
          telegram_token: telegramToken,
          openai_api_key: openaiApiKey,
          platform: "telegram",
          is_active: true,
          telegram_update_offset: 0,
          telegram_display_name: displayName || null,
          telegram_short_description: shortDescription || null,
          telegram_about_text: aboutText || null,
          telegram_commands: Array.isArray(commands) ? commands : [],
        } as any)
        .eq("id", agentId);
      updateError = error;
    }

    // Fallback for minimal schema (without openai_api_key / telegram_update_offset)
    if (updateError && /column .* does not exist/i.test(updateError.message)) {
      const { error } = await supabase
        .from("agents")
        .update({
          telegram_token: telegramToken,
          platform: "telegram",
          is_active: true,
          telegram_display_name: displayName || null,
          telegram_short_description: shortDescription || null,
          telegram_about_text: aboutText || null,
          telegram_commands: Array.isArray(commands) ? commands : [],
        })
        .eq("id", agentId);
      updateError = error;
    }

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update agent: " + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        botInfo,
        message: `Bot @${botInfo.username} is now connected!`,
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
