/**
 * telegram-webhook — Supabase Edge Function
 *
 * Receives Telegram webhook POSTs for a single bot identified by botId in the URL.
 * URL: /functions/v1/telegram-webhook/<botId>
 *
 * Security: Telegram sends X-Telegram-Bot-Api-Secret-Token which must match
 * bots.webhook_secret stored in the database.
 *
 * AI: BYOK with multi-provider support — detects provider from key prefix:
 *   - sk-ant-*  → Anthropic (claude-haiku-4-5)
 *   - AIza*     → Google Gemini (gemini-1.5-flash)
 *   - sk-*      → OpenAI (gpt-4o-mini)
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
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = "claude-haiku-4-5";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";
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
// Bot shell template — wraps every bot's system prompt to ensure consistent,
// intelligent, and natural behaviour across all BotForge bots.
// ---------------------------------------------------------------------------
const BOT_SHELL_TEMPLATE = `## BOTFORGE BEHAVIORAL GUIDELINES

IDENTITY:
- Never say "I am an AI" or "As an AI language model" — just be the bot
- Never repeat the user's question back to them
- Never open with "Great question!", "Certainly!", or "Of course!"

CONVERSATION INTELLIGENCE:
- Use conversation context naturally — reference earlier messages when relevant (e.g. "As you mentioned...")
- Never ask for information the user already provided in this conversation
- Track what the user has shared (name, problem, preferences) and use it

RESPONSE QUALITY:
- Be concise: 2-3 sentences unless detail is genuinely needed
- Use natural language, not corporate speak
- Use emojis sparingly — max 1-2 per message, only when they add real value
- Format with line breaks for readability — avoid markdown (Telegram renders it poorly)
- If you don't know something, say so honestly and offer an alternative

STRICT RULES — NEVER BREAK THESE:
- NEVER invent or guess URLs, website addresses, phone numbers, emails, or any contact information
- NEVER say "visit our website at [url]" unless the exact URL is explicitly provided in your role description below
- NEVER fabricate product names, prices, features, or policies not mentioned in your role description
- If asked for a link or contact and none is provided in your role — say "I don't have that link handy, please check the official channels"

PROACTIVE BEHAVIOR:
- After answering, ask ONE relevant follow-up question to move the conversation forward
- If the user seems confused, offer to explain differently
- If the user's problem is solved, confirm it and ask if they need anything else

LANGUAGE:
- Detect the user's language and respond in that same language
- If the user writes in Russian, respond in Russian. If English, respond in English.
- Maintain consistent language throughout the conversation

CONTEXT:
- You have access to the last 30 messages of this conversation
- Use this context to stay coherent and avoid repeating yourself`;

// ---------------------------------------------------------------------------
// Bot config cache
// ---------------------------------------------------------------------------
const BOT_CACHE_TTL_MS = 5 * 60 * 1_000;

interface CachedBot {
  data: Record<string, unknown>;
  agent: Record<string, unknown> | null;
  cachedAt: number;
}

const botCache = new Map<string, CachedBot>();

function getCachedBot(botId: string): { data: Record<string, unknown>; agent: Record<string, unknown> | null } | null {
  const entry = botCache.get(botId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BOT_CACHE_TTL_MS) {
    botCache.delete(botId);
    return null;
  }
  return { data: entry.data, agent: entry.agent };
}

function setCachedBot(botId: string, data: Record<string, unknown>, agent: Record<string, unknown> | null): void {
  botCache.set(botId, { data, agent, cachedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Layer 2: Build wizard config section from bot + agent data
// ---------------------------------------------------------------------------
function buildWizardConfig(
  bot: Record<string, unknown>,
  agent: Record<string, unknown> | null,
): string {
  const name: string =
    (agent?.telegram_display_name as string | null)?.trim() ||
    (agent?.name as string | null)?.trim() ||
    (bot.name as string | null)?.trim() ||
    "";

  const description: string =
    (agent?.telegram_about_text as string | null)?.trim() ||
    (agent?.about_text as string | null)?.trim() ||
    (agent?.telegram_short_description as string | null)?.trim() ||
    (agent?.description as string | null)?.trim() ||
    "";

  const tone: string = (agent?.tone as string | null)?.trim() || "";

  const rawCommands = agent?.telegram_commands ?? bot.telegram_commands;
  const commands: { command: string; description: string }[] = Array.isArray(rawCommands)
    ? rawCommands.map((c: unknown) => {
        if (typeof c === "object" && c !== null) {
          const obj = c as Record<string, unknown>;
          return {
            command: String(obj.command ?? ""),
            description: String(obj.description ?? ""),
          };
        }
        return { command: String(c), description: "" };
      })
    : [];

  const lines: string[] = ["## YOUR IDENTITY"];
  if (name) lines.push(`Name: ${name}`);
  if (description) lines.push(`Description: ${description}`);
  if (tone) lines.push(`Tone: ${tone}`);
  if (commands.length > 0) {
    lines.push("Available commands:");
    for (const cmd of commands) {
      lines.push(cmd.description ? `  /${cmd.command} — ${cmd.description}` : `  /${cmd.command}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

type Provider = "openai" | "anthropic" | "gemini";

function detectProvider(apiKey: string): Provider | null {
  if (!apiKey) return null;
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("AIza")) return "gemini";
  if (apiKey.startsWith("sk-")) return "openai";
  return null;
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

async function callAnthropic(
  messages: { role: string; content: string }[],
  apiKey: string,
): Promise<{ content: string | null; shouldFallback: boolean }> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: systemMsg?.content ?? "",
        messages: chatMessages,
      }),
      signal: timeoutSignal(AI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Anthropic fetch error:", (err as Error).message);
    return { content: null, shouldFallback: true };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Anthropic error:", res.status, body);
    return { content: null, shouldFallback: res.status !== 400 };
  }

  const data = await res.json().catch(() => ({}));
  const content: string | null = data?.content?.[0]?.text ?? null;
  return { content, shouldFallback: content === null };
}

async function callGemini(
  messages: { role: string; content: string }[],
  apiKey: string,
): Promise<{ content: string | null; shouldFallback: boolean }> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const contents = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const requestBody: Record<string, unknown> = { contents };
  if (systemMsg) {
    requestBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  let res: Response;
  try {
    res = await fetch(`${GEMINI_URL}${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: timeoutSignal(AI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Gemini fetch error:", (err as Error).message);
    return { content: null, shouldFallback: true };
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("Gemini error:", res.status, errBody);
    return { content: null, shouldFallback: res.status !== 400 };
  }

  const data = await res.json().catch(() => ({}));
  const content: string | null =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
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
// Telegram message helpers
// ---------------------------------------------------------------------------
async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
): Promise<{ result: { message_id: number } }> {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.json();
}

async function editTelegramMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text.slice(0, TG_MAX_CHARS) }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// OpenAI streaming — sends interim edits every 800 ms, returns full text
// ---------------------------------------------------------------------------
async function callOpenAiStreaming(
  messages: { role: string; content: string }[],
  apiKey: string,
  botToken: string,
  chatId: number,
  placeholderMsgId: number,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.7, stream: true }),
      signal: timeoutSignal(AI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("OpenAI streaming fetch error:", (err as Error).message);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("OpenAI streaming error:", res.status, body);
    return null;
  }

  const reader = res.body?.getReader();
  if (!reader) return null;

  let accumulated = "";
  let lastEditAt = 0;
  const decoder = new TextDecoder();

  try {
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") break outer;
        try {
          const json = JSON.parse(data);
          const delta: string = json.choices?.[0]?.delta?.content ?? "";
          if (delta) accumulated += delta;
        } catch {
          // Skip malformed SSE lines
        }
      }

      const now = Date.now();
      if (now - lastEditAt > 800 && accumulated.length > 0) {
        await editTelegramMessage(botToken, chatId, placeholderMsgId, accumulated + " ✏️");
        lastEditAt = now;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated || null;
}

// ---------------------------------------------------------------------------
// Core message processing — runs in background via EdgeRuntime.waitUntil()
// TW1: This function is called after Telegram already received 200 OK.
// ---------------------------------------------------------------------------
async function processMessage(
  supabase: ReturnType<typeof createClient>,
  bot: Record<string, unknown>,
  agent: Record<string, unknown> | null,
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

  const botToken: string = (bot.telegram_token as string) ?? "";

  // Send placeholder immediately so user sees activity right away
  let placeholderMsgId: number | null = null;
  try {
    const placeholderRes = await sendTelegramMessage(botToken, chatId, "...");
    placeholderMsgId = placeholderRes?.result?.message_id ?? null;
  } catch (e) {
    console.error("Failed to send placeholder:", e);
  }

  try {

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

  // Greeting fix: tell the model explicitly whether this is a new conversation
  const introRule = history.length === 0
    ? "This is the START of the conversation — you may introduce yourself briefly."
    : "Do NOT introduce yourself — this conversation is already in progress.";

  // 3-layer system prompt assembly:
  // Layer 1: BOT_SHELL_TEMPLATE — behavioral rules
  // Layer 2: Wizard config — identity, name, description, commands
  // Layer 3: User system prompt — custom role & knowledge
  const wizardConfig = buildWizardConfig(bot, agent);
  const finalSystemPrompt =
    BOT_SHELL_TEMPLATE +
    "\n\n" + introRule +
    "\n\n" + wizardConfig +
    "\n\n## YOUR ROLE AND KNOWLEDGE:\n" +
    systemPrompt;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: finalSystemPrompt },
    ...history,
  ];

  // Generate AI reply (BYOK → Lovable fallback)
  // Check bot table first, then fall back to agent table (some keys stored in agents)
  const byokKey: string = (
    ((bot.openai_api_key as string) ?? "").trim() ||
    ((agent?.openai_api_key as string) ?? "").trim()
  );
  let reply: string | null = null;

  if (byokKey) {
    const provider = detectProvider(byokKey);

    if (provider === "openai" && placeholderMsgId) {
      // OpenAI BYOK — real-time streaming with interim message edits
      reply = await callOpenAiStreaming(messages, byokKey, botToken, chatId, placeholderMsgId);
      if (!reply) {
        // Streaming failed — fall back to non-streaming OpenAI then Lovable
        const result = await callOpenAi(messages, byokKey);
        reply = result.content;
        if (!reply && result.shouldFallback && lovableKey) {
          console.log("BYOK streaming failed for bot", botId, "— falling back to Lovable AI");
          reply = await callLovableAi(messages, lovableKey);
        }
      }
    } else {
      // Anthropic or Gemini — non-streaming
      let result: { content: string | null; shouldFallback: boolean };
      if (provider === "anthropic") {
        result = await callAnthropic(messages, byokKey);
      } else if (provider === "gemini") {
        result = await callGemini(messages, byokKey);
      } else {
        result = await callOpenAi(messages, byokKey);
      }
      reply = result.content;
      if (!reply && result.shouldFallback && lovableKey) {
        console.log("BYOK failed for bot", botId, "— falling back to Lovable AI");
        reply = await callLovableAi(messages, lovableKey);
      }
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

  // Edit placeholder with final reply (or send fresh message if placeholder failed)
  if (placeholderMsgId) {
    await editTelegramMessage(botToken, chatId, placeholderMsgId, reply);
  } else {
    await sendTelegramMessage(botToken, chatId, reply).catch((e) => console.error("Telegram sendMessage error:", e));
  }

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

  } catch (err) {
    console.error("processMessage error:", (err as Error).message);
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
  // 1. Load bot config (cache-first) + linked agent for wizard config
  // ------------------------------------------------------------------
  let bot: Record<string, unknown> | null = null;
  let agent: Record<string, unknown> | null = null;

  const cached = getCachedBot(botId);
  if (cached) {
    bot = cached.data;
    agent = cached.agent;
  }

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

    // Load linked agent (has identity/wizard config: name, description, commands, tone)
    const agentId = mutable.agent_id as string | null;
    if (agentId) {
      const { data: freshAgent } = await supabase
        .from("agents")
        .select("name, description, about_text, telegram_display_name, telegram_short_description, telegram_about_text, telegram_commands, tone")
        .eq("id", agentId)
        .maybeSingle();
      if (freshAgent) {
        const mutableAgent = { ...freshAgent } as Record<string, unknown>;
        if (mutableAgent.openai_api_key) {
          mutableAgent.openai_api_key = await tryDecrypt(mutableAgent.openai_api_key as string);
        }
        agent = mutableAgent;
      } else {
        agent = null;
      }
    }

    setCachedBot(botId, mutable, agent);
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
  const bgWork = processMessage(supabase, bot, agent, botId, chatId, userText, updateId, lovableKey);

  // @ts-ignore — EdgeRuntime is a Supabase/Deno edge-runtime global
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(bgWork);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
