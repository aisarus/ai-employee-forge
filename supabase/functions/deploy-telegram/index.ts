import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callTelegram(method: string, body: Record<string, any>, lovableKey: string, telegramKey: string) {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Telegram ${method} failed:`, data);
  }
  return { ok: res.ok, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { agentId, telegramToken, displayName, shortDescription, aboutText, commands } = await req.json();

    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the agent
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate token via getMe
    const meResult = await callTelegram("getMe", {}, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    if (!meResult.ok) {
      return new Response(JSON.stringify({ error: `Telegram API error: ${JSON.stringify(meResult.data)}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botInfo = meResult.data.result;

    // 2. Set bot name if provided
    if (displayName) {
      await callTelegram("setMyName", { name: displayName }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    }

    // 3. Set bot short description
    if (shortDescription) {
      await callTelegram("setMyShortDescription", { short_description: shortDescription }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    }

    // 4. Set bot description (about text)
    if (aboutText) {
      await callTelegram("setMyDescription", { description: aboutText }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    }

    // 5. Set bot commands
    if (commands && Array.isArray(commands) && commands.length > 0) {
      await callTelegram("setMyCommands", { commands }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    }

    // 6. Update agent with telegram info and activate
    const { error: updateError } = await supabase
      .from("agents")
      .update({
        telegram_token: telegramToken || "connected",
        platform: "telegram",
        is_active: true,
      })
      .eq("id", agentId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update agent" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      botInfo,
      message: `Bot @${botInfo.username} is now connected!`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
