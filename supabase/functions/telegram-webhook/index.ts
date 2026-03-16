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
 * Fallback: if BYOK key is absent, errors, or times out, falls back to Lovable AI gateway.
 *
 * Context: last 30 turns from bot_chat_history for the (bot, chat) pair.
 *
 * TW1 fix: Respond to Telegram immediately (< 1 s), process AI in background
 *          via EdgeRuntime.waitUntil() to stay well within the 15 s deadline.
 * TW3 fix: Truncate AI responses > 4000 chars to avoid Telegram sendMessage crash.
 * TW4 fix: Lovable AI (shared key) is rate-limited to 20 messages / hour per bot.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryDecrypt } from "../_shared/crypto.ts";

const TELEGRAM_API = "https://api.telegram.org";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-2.0-flash-exp";
const OPENAI_MODEL = "gpt-4o-mini";
const HISTORY_LIMIT = 30;
/** TW1: Reduced from 20 s to 12 s so AI fits inside Telegram's 15 s window */
const AI_TIMEOUT_MS = 12_000;
/** TW3: Max chars allowed by Telegram sendMessage */
const TG_MAX_CHARS = 4000;
/** TW4: Max Lovable AI (shared key) messages per bot per hour */
const LOVABLE_RATE_LIMIT = 20;

// ---------------------------------------------------------------------------
// Bot config cache
// ---------------------------------------------------------------------------
const BOT_CACHE_TTL_MS = 5 * 60 * 1_000;

interface CachedBot {
  data: Record<string, unknown>;
  cachedAt: number;
}

const botCache = new Map<string, CachedBot>();

function getCachedBot(botId: string): Record<string, unknown> | null {
  const entry = botCache.get(botId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BOT_CACHE_TTL_MS) {
    botCache.delete(botId);
    return null;
  }
  return entry.data;
}

function setCachedBot(botId: string, data: Record<string, unknown>): void {
  botCache.set(botId, { data, cachedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function callOpenAi(
  messages: { role: string; content: string }[],
  apiKey: string,
): Promise<{ content: string | null; shouldFallback: boolean }> {
  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.7 }),
      signal: timeoutSignal(AI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("OpenAI fetch error:", (err as Error).message);
    return { content: null, shouldFallback: true };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("OpenAI error:", res.status, body);
    return { content: null, shouldFallback: res.status !== 400 };
  }

  const data = await res.json().catch(() => ({}));
  const content: string | null = data?.choices?.[0]?.message?.content ?? null;
  return { content, shouldFallback: content === null };
}

async function callLovableAi(
  messages: { role: string; content: string }[],
  lovableKey: string,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({ model: LOVABLE_MODEL, messages, temperature: 0.7 }),
      signal: timeoutSignal(AI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Lovable AI fetch error:", (err as Error).message);
    return null;
  }

  if (!res.ok) {
    console.error("Lovable AI error:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content ?? null;
}

// ---------------------------------------------------------------------------
// TW4: Rate limit check — max LOVABLE_RATE_LIMIT messages/hour per bot
// ---------------------------------------------------------------------------
async function isRateLimited(
  supabase: ReturnType<typeof createClient>,
  botId: string,
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1_000).toISOString();
  const { count } = await supabase
    .from("bot_chat_history")
    .select("id", { count: "exact", head: true })
    .eq("bot_id", botId)
    .eq("role", "user")
    .gte("created_at", oneHourAgo);
  return (count ?? 0) >= LOVABLE_RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// /start handler
// ---------------------------------------------------------------------------
async function handleStart(
  bot: Record<string, unknown>,
  chatId: number,
): Promise<void> {
  const welcomeText: string = (bot.welcome_message as string | null)?.trim() ?? "";
  const starterButtons: { text: string }[] = (() => {
    const raw = bot.starter_buttons;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((b: unknown) =>
      typeof b === "string" ? { text: b } : { text: (b as { text: string }).text }
    );
  })();

  const replyMarkup = starterButtons.length > 0
    ? {
        keyboard: starterButtons.reduce<{ text: string }[][]>((rows, btn, i) => {
          if (i % 2 === 0) rows.push([]);
          rows[rows.length - 1].push(btn);
          return rows;
        }, []),
        resize_keyboard: true,
        one_time_keyboard: false,
      }
    : { remove_keyboard: true };

  await fetch(`${TELEGRAM_API}/bot${bot.telegram_token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: welcomeText || "👋 Hello! How can I help you?",
      reply_markup: replyMarkup,
    }),
  }).catch((e) => console.error("Telegram /start sendMessage error:", e));
}

// ---------------------------------------------------------------------------
// Core message processing — runs in background via EdgeRuntime.waitUntil()
// TW1: This function is called after Telegram already received 200 OK.
// ---------------------------------------------------------------------------
async function processMessage(
  supabase: ReturnType<typeof createClient>,
  bot: Record<string, unknown>,
  botId: string,
  chatId: number,
  userText: string,
  updateId: number | undefined,
  lovableKey: string,
): Promise<void> {
  // /start — send welcome message, no AI needed
  if (userText === "/start") {
    await handleStart(bot, chatId);
    return;
  }

  // TW2: Send typing indicator so the user sees '...' while AI generates
  const botToken: string = (bot.telegram_token as string) ?? "";
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {}); // Non-critical — ignore failures

  // Deduplicate: skip already-processed update_ids
  if (updateId != null) {
    const { data: existing } = await supabase
      .from("bot_chat_history")
      .select("id")
      .eq("bot_id", botId)
      .eq("telegram_update_id", updateId)
      .maybeSingle();

    if (existing) {
      console.log("Duplicate update_id", updateId, "for bot", botId, "— skipping");
      return;
    }
  }

  // Store incoming user message
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

  // Load last 30 messages for context
  const { data: rawHistory } = await supabase
    .from("bot_chat_history")
    .select("role, content")
    .eq("bot_id", botId)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: { role: string; content: string }[] = (rawHistory ?? []).reverse();

  // Build messages array for the LLM
  const systemPrompt: string = (bot.system_prompt as string) ?? "";
  const hasExplicitLanguage =
    /always respond in |всегда отвечай на |язык ответ|response language|LANGUAGE[:\s]/i.test(
      systemPrompt,
    );
  const languageRule = hasExplicitLanguage
    ? ""
    : "\n\nIMPORTANT: Always respond in the same language the user writes to you.";

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt + languageRule },
    ...history,
  ];

  // Generate AI reply (BYOK → Lovable fallback)
  const byokKey: string = ((bot.openai_api_key as string) ?? "").trim();
  let reply: string | null = null;

  if (byokKey) {
    // BYOK — no rate limit
    const result = await callOpenAi(messages, byokKey);
    reply = result.content;

    if (!reply && result.shouldFallback && lovableKey) {
      console.log("BYOK failed for bot", botId, "— falling back to Lovable AI");
      reply = await callLovableAi(messages, lovableKey);
    }
  } else if (lovableKey) {
    // TW4: Shared Lovable AI key — enforce per-bot hourly rate limit
    const limited = await isRateLimited(supabase, botId);
    if (limited) {
      reply =
        "⚠️ This bot has reached its free message limit (20 messages/hour). " +
        "To keep chatting without limits, the bot owner needs to add their own OpenAI API key.";
    } else {
      reply = await callLovableAi(messages, lovableKey);
    }
  }

  if (!reply) {
    const customFallback = (bot.fallback_message as string | null)?.trim();
    reply = customFallback || "⚠️ AI is temporarily unavailable. Please try again later.";
  }

  // TW3: Truncate to Telegram's 4096-char limit (use 4000 for safety)
  if (reply.length > TG_MAX_CHARS) {
    reply = reply.slice(0, TG_MAX_CHARS) + "...";
  }

  // Send reply via Telegram
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  }).catch((e) => console.error("Telegram sendMessage error:", e));

  // Store assistant reply
  const { error: replyInsertError } = await supabase.from("bot_chat_history").insert({
    bot_id: botId,
    chat_id: chatId,
    role: "assistant",
    content: reply,
  });
  if (replyInsertError) {
    console.error("Failed to save assistant reply:", replyInsertError.message);
  }
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // ------------------------------------------------------------------
  // 1. Load bot config (cache-first)
  // ------------------------------------------------------------------
  let bot: Record<string, unknown> | null = getCachedBot(botId);

  if (!bot) {
    const { data: freshBot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .eq("is_active", true)
      .maybeSingle();

    if (botError || !freshBot) {
      console.error("Bot not found or inactive:", botId, botError?.message);
      // Always 200 to Telegram so it doesn't retry endlessly
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // S1/S2: Decrypt credentials stored encrypted in DB (legacy plaintext rows also handled)
    const mutable = { ...freshBot } as Record<string, unknown>;
    if (mutable.telegram_token) {
      mutable.telegram_token = await tryDecrypt(mutable.telegram_token as string);
    }
    if (mutable.openai_api_key) {
      mutable.openai_api_key = await tryDecrypt(mutable.openai_api_key as string);
    }

    setCachedBot(botId, mutable);
    bot = mutable;
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
  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  // ------------------------------------------------------------------
  // 3a. Handle callback_query — acknowledge immediately, reroute as text
  // ------------------------------------------------------------------
  if (update?.callback_query) {
    const cq = update.callback_query as Record<string, unknown>;
    await fetch(`${TELEGRAM_API}/bot${bot.telegram_token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: (cq as Record<string, unknown>).id }),
    }).catch((e) => console.error("answerCallbackQuery error:", e));

    const cbChatId = (cq.message as Record<string, unknown>)?.chat as { id?: number } | undefined;
    const cbText: string | undefined = cq.data as string | undefined;
    if (!cbChatId?.id || !cbText) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    update = {
      update_id: update.update_id,
      message: {
        chat: { id: cbChatId.id },
        text: cbText,
        message_id: (cq.message as Record<string, unknown>)?.message_id,
      },
    };
  }

  const chatId: number | undefined = (update?.message as Record<string, unknown>)?.chat
    ? ((update.message as Record<string, unknown>).chat as Record<string, unknown>).id as number
    : undefined;
  const userText: string | undefined = (update?.message as Record<string, unknown>)?.text as
    | string
    | undefined;
  const updateId: number | undefined = update?.update_id as number | undefined;

  // Ignore non-text messages silently
  if (!chatId || !userText) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // ------------------------------------------------------------------
  // TW1: Respond immediately to Telegram (< 1 s), process in background.
  // EdgeRuntime.waitUntil() keeps the function alive until processing completes.
  // ------------------------------------------------------------------
  const bgWork = processMessage(supabase, bot, botId, chatId, userText, updateId, lovableKey);

  // @ts-ignore — EdgeRuntime is a Supabase/Deno edge-runtime global
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(bgWork);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
