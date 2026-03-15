/**
 * telegram-webhook — Supabase Edge Function
 *
 * Receives Telegram webhook POSTs for a single bot identified by botId in the URL.
 * URL: /functions/v1/telegram-webhook/<botId>
 *
 * Security: Telegram sends X-Telegram-Bot-Api-Secret-Token which must match
 * bots.webhook_secret stored in the database.
 *
 * AI: Uses the bot's BYOK openai_api_key (gpt-4o-mini).
 * Fallback: if BYOK key is absent or returns 402/403/429, falls back to Lovable AI gateway.
 *
 * Context: last 30 turns from bot_chat_history for the (bot, chat) pair.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const OPENAI_MODEL = "gpt-4o-mini";
const HISTORY_LIMIT = 30;
const BYOK_FALLBACK_STATUSES = new Set([402, 403, 429]);

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

async function callOpenAi(
  messages: { role: string; content: string }[],
  apiKey: string
): Promise<{ content: string | null; shouldFallback: boolean }> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.7 }),
  });

  if (!res.ok) {
    console.error("OpenAI error:", res.status, await res.text().catch(() => ""));
    return { content: null, shouldFallback: BYOK_FALLBACK_STATUSES.has(res.status) };
  }

  const data = await res.json().catch(() => ({}));
  return { content: data?.choices?.[0]?.message?.content ?? null, shouldFallback: false };
}

async function callLovableAi(
  messages: { role: string; content: string }[],
  lovableKey: string
): Promise<string | null> {
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({ model: LOVABLE_MODEL, messages, temperature: 0.7 }),
  });

  if (!res.ok) {
    console.error("Lovable AI error:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content ?? null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Extract botId from path: /functions/v1/telegram-webhook/<botId>
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const botId = pathParts[pathParts.length - 1];

  if (!botId || botId === "telegram-webhook") {
    return new Response(JSON.stringify({ error: "botId missing in URL path" }), { status: 400 });
  }

  // Service-role client — bypasses RLS so the function can read any bot
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // ------------------------------------------------------------------
  // 1. Load bot config
  // ------------------------------------------------------------------
  const { data: bot, error: botError } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .eq("is_active", true)
    .maybeSingle();

  if (botError || !bot) {
    console.error("Bot not found or inactive:", botId, botError?.message);
    // Always respond 200 to Telegram so it doesn't retry endlessly
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // ------------------------------------------------------------------
  // 2. Verify Telegram webhook secret
  // ------------------------------------------------------------------
  const incomingSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (bot.webhook_secret && incomingSecret !== bot.webhook_secret) {
    console.error("Webhook secret mismatch for bot:", botId);
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // ------------------------------------------------------------------
  // 3. Parse Telegram update
  // ------------------------------------------------------------------
  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const chatId: number | undefined = update?.message?.chat?.id;
  const userText: string | undefined = update?.message?.text;
  const updateId: number | undefined = update?.update_id;

  // Ignore non-text messages silently
  if (!chatId || !userText) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // ------------------------------------------------------------------
  // 4. Deduplicate: skip if we already processed this update_id
  // ------------------------------------------------------------------
  if (updateId != null) {
    const { data: existing } = await supabase
      .from("bot_chat_history")
      .select("id")
      .eq("bot_id", botId)
      .eq("telegram_update_id", updateId)
      .maybeSingle();

    if (existing) {
      console.log("Duplicate update_id", updateId, "for bot", botId, "— skipping");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  }

  // ------------------------------------------------------------------
  // 5. Store incoming user message in bot_chat_history
  // ------------------------------------------------------------------
  const { error: insertError } = await supabase.from("bot_chat_history").insert({
    bot_id: botId,
    chat_id: chatId,
    role: "user",
    content: userText,
    telegram_update_id: updateId ?? null,
  });

  if (insertError) {
    console.error("Failed to save user message:", insertError.message);
  }

  // ------------------------------------------------------------------
  // 6. Load the last 30 messages (DESC → reverse to chronological order)
  // ------------------------------------------------------------------
  const { data: rawHistory } = await supabase
    .from("bot_chat_history")
    .select("role, content")
    .eq("bot_id", botId)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  // Reverse from newest-first to chronological order for the LLM
  const history: { role: string; content: string }[] = (rawHistory ?? []).reverse();

  // ------------------------------------------------------------------
  // 7. Build messages array for the LLM
  // ------------------------------------------------------------------
  const systemPrompt: string = bot.system_prompt ?? "";
  const hasExplicitLanguage =
    /always respond in |всегда отвечай на |язык ответ|response language|LANGUAGE[:\s]/i.test(
      systemPrompt
    );
  const languageRule = hasExplicitLanguage
    ? ""
    : "\n\nIMPORTANT: Always respond in the same language the user writes to you.";

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt + languageRule },
    ...history,
  ];

  // ------------------------------------------------------------------
  // 8. Generate AI reply (BYOK → Lovable fallback)
  // ------------------------------------------------------------------
  const botToken: string = bot.telegram_token ?? "";
  const byokKey: string = (bot.openai_api_key ?? "").trim();
  let reply: string | null = null;

  if (byokKey) {
    const result = await callOpenAi(messages, byokKey);
    reply = result.content;

    if (!reply && result.shouldFallback && lovableKey) {
      console.log("BYOK failed for bot", botId, "— falling back to Lovable AI");
      reply = await callLovableAi(messages, lovableKey);
    }
  } else if (lovableKey) {
    reply = await callLovableAi(messages, lovableKey);
  }

  if (!reply) {
    reply = "⚠️ AI is temporarily unavailable. Please try again later.";
  }

  // ------------------------------------------------------------------
  // 9. Send reply via Telegram
  // ------------------------------------------------------------------
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  }).catch((e) => console.error("Telegram sendMessage error:", e));

  // ------------------------------------------------------------------
  // 10. Store assistant reply in bot_chat_history
  // ------------------------------------------------------------------
  const { error: replyInsertError } = await supabase.from("bot_chat_history").insert({
    bot_id: botId,
    chat_id: chatId,
    role: "assistant",
    content: reply,
  });

  if (replyInsertError) {
    console.error("Failed to save assistant reply:", replyInsertError.message);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
