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
 * TW5 fix: Stable history + reliable BYOK:
 *   - Guarantee current user message in LLM context even if DB insert fails
 *   - OpenAI: 1 retry on timeout/network error and on 5xx transient errors
 *   - OpenAI 401 (invalid key): surface error to user, do NOT fall back to Lovable
 *   - system_prompt: read from agents table as fallback when bots.system_prompt is empty
 * TW6 fix: Smart typing indicators:
 *   - sendChatAction(typing) fired immediately on message receipt (before DB work)
 *   - Streaming (OpenAI/Gemini BYOK): editMessageText every 800 ms shows live output
 *   - Non-streaming (Anthropic, Lovable): keepTyping() resends action every 4 s while
 *     LLM is thinking, ensuring the indicator never expires mid-generation
 * TW7 fix: Robust history + stable BYOK streaming:
 *   - normalizeHistory() merges consecutive same-role turns so OpenAI never sees
 *     [user, user] sequences (caused by failed assistant-reply DB inserts → 400 errors)
 *   - OpenAI streaming: catch read-loop errors and return accumulated partial text
 *     instead of null (preserves output on mid-stream network drops)
 *   - OpenAI streaming 401: return error message directly, skip redundant non-streaming
 *     retry with the same invalid key
 *   - Gemini streaming: same read-loop catch + 400/403 key-error fast-path
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryDecrypt } from "../_shared/crypto.ts";

const TELEGRAM_API = "https://api.telegram.org";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";
const GEMINI_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse&key=";
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

interface ConnectorRow {
  id: string;
  connector_type: string;
  display_name: string;
  status: string;
  auth_value: string;
  capabilities: string[];
  config: Record<string, string>;
}

interface CachedBot {
  data: Record<string, unknown>;
  agent: Record<string, unknown> | null;
  connectors: ConnectorRow[];
  cachedAt: number;
}

const botCache = new Map<string, CachedBot>();

function getCachedBot(botId: string): { data: Record<string, unknown>; agent: Record<string, unknown> | null; connectors: ConnectorRow[] } | null {
  const entry = botCache.get(botId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BOT_CACHE_TTL_MS) {
    botCache.delete(botId);
    promptCache.delete(botId); // invalidate assembled prompt alongside bot data
    return null;
  }
  return { data: entry.data, agent: entry.agent, connectors: entry.connectors };
}

function setCachedBot(
  botId: string,
  data: Record<string, unknown>,
  agent: Record<string, unknown> | null,
  connectors: ConnectorRow[],
): void {
  botCache.set(botId, { data, agent, connectors, cachedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// System prompt cache
// Stores the pre-assembled static portion of the system prompt per bot so
// that buildWizardConfig() and string concatenation are skipped on warm
// requests.  The cache is invalidated whenever botCache expires (same TTL),
// guaranteeing that a prompt change always propagates within 5 minutes.
// Dynamic parts (introRule, connectorContext) are appended at request time.
// ---------------------------------------------------------------------------
interface CachedPrompt {
  identityBlock: string; // wizardConfig + "## YOUR ROLE AND KNOWLEDGE:\n" + systemPrompt
  cachedAt: number;
}

const promptCache = new Map<string, CachedPrompt>();

function getCachedPrompt(botId: string): string | null {
  const entry = promptCache.get(botId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BOT_CACHE_TTL_MS) {
    promptCache.delete(botId);
    return null;
  }
  return entry.identityBlock;
}

function setCachedPrompt(botId: string, identityBlock: string): void {
  promptCache.set(botId, { identityBlock, cachedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Connector helpers
// ---------------------------------------------------------------------------

/** Load and decrypt all connected connectors for an agent. */
async function loadConnectors(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
): Promise<ConnectorRow[]> {
  const { data, error } = await supabase
    .from("bot_connectors")
    .select("id, connector_type, display_name, status, auth_value, capabilities, config")
    .eq("agent_id", agentId)
    .eq("status", "connected");

  if (error || !data) return [];

  return Promise.all(
    (data as any[]).map(async (row: any) => {
      let auth_value = "";
      if (row.auth_value) {
        try { auth_value = await tryDecrypt(row.auth_value); } catch { auth_value = row.auth_value; }
      }
      return {
        id: row.id,
        connector_type: row.connector_type,
        display_name: row.display_name,
        status: row.status,
        auth_value,
        capabilities: row.capabilities ?? [],
        config: (row.config ?? {}) as Record<string, string>,
      };
    }),
  );
}

/**
 * Fetch read data from Google Sheets for a connector.
 * Returns up to 20 rows as a formatted string, or null on error.
 */
async function fetchGoogleSheetsData(
  connector: ConnectorRow,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string | null> {
  const cfg = connector.config;
  const spreadsheetId = cfg.spreadsheet_id;
  if (!spreadsheetId) return null;

  const sheetName = cfg.sheet_name || "Sheet1";
  const range = `${sheetName}!A1:Z20`;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/google-sheets-connector`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        action: "read",
        spreadsheetId,
        range,
        ...(cfg.auth_mode === "oauth"
          ? { accessToken: connector.auth_value }
          : { apiKey: connector.auth_value }),
      }),
      signal: AbortSignal.timeout(3_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.rows?.length) return null;

    // Format rows as text (first row assumed to be header)
    const rows: string[][] = data.rows;
    const header = rows[0] ?? [];
    const dataRows = rows.slice(1, 11); // max 10 data rows injected

    if (dataRows.length === 0) return `(No entries yet — spreadsheet is empty)`;

    const lines = dataRows.map((row: string[]) => {
      const pairs = header.map((h: string, i: number) => `${h}: ${row[i] ?? ""}`)
        .filter((p: string) => !p.endsWith(": "));
      return "• " + pairs.join(", ");
    });

    return lines.join("\n");
  } catch {
    return null;
  }
}

/**
 * Fetch recent entries from a Notion database for a connector.
 * Returns up to 5 pages as a formatted string, or null on error.
 */
async function fetchNotionData(
  connector: ConnectorRow,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string | null> {
  const cfg = connector.config;
  const databaseId = cfg.database_id;
  if (!databaseId) return null;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/notion-connector`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        action: "query",
        databaseId,
        integrationToken: connector.auth_value,
        pageSize: 5,
      }),
      signal: AbortSignal.timeout(3_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.results?.length) return null;

    const lines = (data.results as any[]).map((r: any) => {
      const props = Object.entries(r.properties as Record<string, string>)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `• ${props}`;
    });

    return lines.join("\n");
  } catch {
    return null;
  }
}

/**
 * Build the CONNECTED INTEGRATIONS section for the system prompt.
 * Includes read data fetched from connected sources.
 */
async function buildConnectorContext(
  connectors: ConnectorRow[],
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  if (connectors.length === 0) return "";

  const sections: string[] = ["## CONNECTED INTEGRATIONS"];

  for (const c of connectors) {
    const caps = (c.capabilities ?? []).join(" + ") || "read+write";
    const cfg = c.config ?? {};

    if (c.connector_type === "google_sheets") {
      sections.push(`\n📊 Google Sheets (${caps})`);
      if (cfg.spreadsheet_id) sections.push(`Spreadsheet ID: ${cfg.spreadsheet_id}`);
      if (cfg.sheet_name) sections.push(`Sheet: ${cfg.sheet_name}`);

      if (c.capabilities.includes("read")) {
        const data = await fetchGoogleSheetsData(c, supabaseUrl, serviceKey);
        if (data) {
          sections.push("Current data (last entries):\n" + data);
        }
      }

      if (c.capabilities.includes("write")) {
        sections.push(
          "\nWRITE INSTRUCTIONS — Google Sheets:\n" +
          "When you have collected ALL required data and the user confirms, append this tag EXACTLY at the end of your response (it will be stripped before sending to user):\n" +
          "[SAVE:google_sheets:field1=value1|field2=value2|field3=value3]\n" +
          "Example: [SAVE:google_sheets:name=John Smith|phone=+1234567890|date=2024-01-20]\n" +
          "ONLY include the [SAVE:...] tag when the user has explicitly confirmed and ALL fields are collected.",
        );
      }
    }

    if (c.connector_type === "notion") {
      sections.push(`\n📝 Notion (${caps})`);
      if (cfg.database_id) sections.push(`Database ID: ${cfg.database_id}`);
      if (cfg.database_name) sections.push(`Database: ${cfg.database_name}`);

      if (c.capabilities.includes("read")) {
        const data = await fetchNotionData(c, supabaseUrl, serviceKey);
        if (data) {
          sections.push("Recent entries:\n" + data);
        }
      }

      if (c.capabilities.includes("write")) {
        sections.push(
          "\nWRITE INSTRUCTIONS — Notion:\n" +
          "When you have collected ALL required data and the user confirms, append this tag EXACTLY at the end of your response:\n" +
          "[SAVE:notion:field1=value1|field2=value2|field3=value3]\n" +
          "Example: [SAVE:notion:Name=John Smith|Status=Active|Phone=+1234567890]\n" +
          "ONLY include the [SAVE:...] tag when the user has explicitly confirmed and ALL fields are collected.",
        );
      }
    }

    if (c.connector_type === "airtable") {
      sections.push(`\n🗄️ Airtable (${caps})`);
      if (cfg.base_id) sections.push(`Base: ${cfg.base_id}`);
      if (cfg.table_name) sections.push(`Table: ${cfg.table_name}`);
      if (c.capabilities.includes("write")) {
        sections.push(
          "\nWRITE INSTRUCTIONS — Airtable:\n" +
          "When data is ready: [SAVE:airtable:field1=value1|field2=value2]",
        );
      }
    }

    if (c.connector_type === "webhook" || c.connector_type === "custom_api") {
      sections.push(`\n🔗 ${c.display_name} (${caps})`);
      if (c.capabilities.includes("write")) {
        sections.push(
          `When action is required: [SAVE:webhook:field1=value1|field2=value2]`,
        );
      }
    }
  }

  return sections.join("\n");
}

/** Regex to find [SAVE:connector_type:key=val|...] tags in AI response. */
const SAVE_TAG_RE = /\[SAVE:(\w+):([^\]]+)\]/g;

/**
 * Parse [SAVE:...] tags from the AI reply, execute the connector writes,
 * and return the clean reply (tags stripped) plus a status line.
 */
async function executeConnectorWrites(
  reply: string,
  connectors: ConnectorRow[],
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ cleanReply: string; savedLines: string[] }> {
  const savedLines: string[] = [];
  const matches = [...reply.matchAll(SAVE_TAG_RE)];

  if (matches.length === 0) {
    return { cleanReply: reply, savedLines };
  }

  for (const match of matches) {
    const connectorType = match[1];
    const rawPairs = match[2];

    // Parse key=value|key=value pairs (value may contain = signs)
    const fields: Record<string, string> = {};
    for (const pair of rawPairs.split("|")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const k = pair.slice(0, eqIdx).trim();
      const v = pair.slice(eqIdx + 1).trim();
      if (k) fields[k] = v;
    }

    const connector = connectors.find((c) => c.connector_type === connectorType);
    if (!connector) continue;

    const cfg = connector.config ?? {};

    // ── Google Sheets write ────────────────────────────────────────────────
    if (connectorType === "google_sheets") {
      const spreadsheetId = cfg.spreadsheet_id;
      if (!spreadsheetId) continue;

      const sheetName = cfg.sheet_name || "Sheet1";
      const row = Object.values(fields);

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/google-sheets-connector`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            action: "append",
            spreadsheetId,
            sheetName,
            values: [row],
            ...(cfg.auth_mode === "oauth"
              ? { accessToken: connector.auth_value }
              : { apiKey: connector.auth_value }),
          }),
          signal: AbortSignal.timeout(5_000),
        });

        const result = await res.json().catch(() => ({}));
        if (result.success) {
          savedLines.push(`✅ Saved to Google Sheets (${sheetName})`);
          console.log(`[connector] Appended row to Google Sheets for agent, row: ${JSON.stringify(fields)}`);
        } else {
          console.error(`[connector] Google Sheets write failed: ${result.error}`);
          savedLines.push(`⚠️ Failed to save to Google Sheets`);
        }
      } catch (e) {
        console.error(`[connector] Google Sheets fetch error: ${(e as Error).message}`);
      }
    }

    // ── Notion write ───────────────────────────────────────────────────────
    if (connectorType === "notion") {
      const databaseId = cfg.database_id;
      if (!databaseId) continue;

      // Build Notion properties from flat key=value pairs
      // We build simple title/rich_text properties
      const notionProperties: Record<string, unknown> = {};
      const entries = Object.entries(fields);

      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        if (i === 0) {
          // First field → title property
          notionProperties[key] = {
            title: [{ text: { content: value } }],
          };
        } else {
          // Rest → rich_text
          notionProperties[key] = {
            rich_text: [{ text: { content: value } }],
          };
        }
      }

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/notion-connector`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            action: "create_page",
            databaseId,
            integrationToken: connector.auth_value,
            properties: notionProperties,
          }),
          signal: AbortSignal.timeout(5_000),
        });

        const result = await res.json().catch(() => ({}));
        if (result.success) {
          savedLines.push(`✅ Saved to Notion`);
          console.log(`[connector] Created Notion page, id: ${result.pageId}`);
        } else {
          console.error(`[connector] Notion write failed: ${result.error}`);
          savedLines.push(`⚠️ Failed to save to Notion`);
        }
      } catch (e) {
        console.error(`[connector] Notion fetch error: ${(e as Error).message}`);
      }
    }

    // ── Webhook / Custom API write ─────────────────────────────────────────
    if (connectorType === "webhook" || connectorType === "custom_api") {
      const webhookUrl = connector.auth_value || cfg.url;
      if (!webhookUrl) continue;

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: fields, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(5_000),
        });

        if (res.ok) {
          savedLines.push(`✅ Webhook delivered`);
        } else {
          savedLines.push(`⚠️ Webhook returned HTTP ${res.status}`);
        }
      } catch (e) {
        console.error(`[connector] Webhook error: ${(e as Error).message}`);
      }
    }
  }

  // Strip all [SAVE:...] tags from reply
  const cleanReply = reply.replace(SAVE_TAG_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { cleanReply, savedLines };
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

/**
 * Normalize message history to ensure proper user/assistant alternation.
 *
 * If a previous AI call failed without saving the assistant reply, history can
 * contain consecutive same-role messages (e.g. [user, user]).  OpenAI rejects
 * such payloads with a 400 error.  We merge consecutive same-role messages by
 * concatenating their content, which is semantically lossless and always
 * produces a valid alternating sequence.
 */
function normalizeHistory(
  history: { role: string; content: string }[],
): { role: string; content: string }[] {
  const result: { role: string; content: string }[] = [];
  for (const msg of history) {
    const last = result[result.length - 1];
    if (last && last.role === msg.role) {
      last.content = last.content + "\n\n" + msg.content;
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }
  return result;
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
  retries = 1,
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
    console.error("OpenAI fetch error (timeout/network):", (err as Error).message);
    // Retry once on timeout/network error before falling back
    if (retries > 0) {
      console.log("OpenAI: retrying after network error...");
      return callOpenAi(messages, apiKey, retries - 1);
    }
    return { content: null, shouldFallback: true };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("OpenAI error:", res.status, body.slice(0, 200));
    // 401 = invalid API key (permanent) — surface as error, don't fallback to Lovable
    if (res.status === 401) {
      return { content: "⚠️ OpenAI API key is invalid or expired. Please update your key in bot settings.", shouldFallback: false };
    }
    // 5xx = transient server error — retry once
    if (res.status >= 500 && retries > 0) {
      console.log(`OpenAI 5xx (${res.status}), retrying...`);
      return callOpenAi(messages, apiKey, retries - 1);
    }
    // 400 = bad request (wrong model, bad payload) — don't fallback
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
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return await res.json().catch(() => ({ result: { message_id: 0 } }));
  } catch (err) {
    console.error("sendTelegramMessage network error:", (err as Error).message);
    return { result: { message_id: 0 } };
  }
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

/**
 * Periodically resend the Telegram 'typing' chat action every 4 s
 * (the indicator auto-disappears after ~5 s, so 4 s keeps it alive).
 * Call without await to run in background; abort via the AbortController.
 */
async function keepTyping(token: string, chatId: number, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    fetch(`${TELEGRAM_API}/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    }).catch(() => {});
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 4_000);
      signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
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
    console.error("OpenAI streaming error:", res.status, body.slice(0, 200));
    // Surface invalid-key error immediately — do NOT fall back to Lovable with a bad key
    if (res.status === 401) {
      return "⚠️ OpenAI API key is invalid or expired. Please update your key in bot settings.";
    }
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
  } catch (err) {
    // Network drop / AbortError mid-stream — return whatever was accumulated
    console.error("OpenAI streaming read error:", (err as Error).message);
    return accumulated || null;
  } finally {
    reader.releaseLock();
  }

  return accumulated || null;
}

// ---------------------------------------------------------------------------
// Gemini streaming — sends interim edits every 800 ms, returns full text
// ---------------------------------------------------------------------------
async function callGeminiStreaming(
  messages: { role: string; content: string }[],
  apiKey: string,
  botToken: string,
  chatId: number,
  placeholderMsgId: number,
): Promise<string | null> {
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
    res = await fetch(`${GEMINI_STREAM_URL}${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: timeoutSignal(AI_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Gemini streaming fetch error:", (err as Error).message);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Gemini streaming error:", res.status, body.slice(0, 200));
    // Surface invalid-key error immediately — do NOT fall back to Lovable with a bad key
    if (res.status === 400 || res.status === 403) {
      return "⚠️ Gemini API key is invalid or not authorized. Please update your key in bot settings.";
    }
    return null;
  }

  const reader = res.body?.getReader();
  if (!reader) return null;

  let accumulated = "";
  let lastEditAt = 0;
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        try {
          const json = JSON.parse(data);
          const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (text) accumulated += text;
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
  } catch (err) {
    // Network drop / AbortError mid-stream — return whatever was accumulated
    console.error("Gemini streaming read error:", (err as Error).message);
    return accumulated || null;
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
  connectors: ConnectorRow[],
  botId: string,
  chatId: number,
  userText: string,
  updateId: number | undefined,
  lovableKey: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<void> {
  // /start — send welcome message, no AI needed
  if (userText === "/start") {
    await handleStart(bot, chatId);
    return;
  }

  const botToken: string = (bot.telegram_token as string) ?? "";

  try {

  // Deduplicate: skip already-processed update_ids — check BEFORE sending placeholder
  // to avoid orphaned "..." messages in chat
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

  // Send placeholder immediately so user sees activity right away
  let placeholderMsgId: number | null = null;
  try {
    const placeholderRes = await sendTelegramMessage(botToken, chatId, "...");
    placeholderMsgId = placeholderRes?.result?.message_id ?? null;
  } catch (e) {
    console.error("Failed to send placeholder:", e);
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
  const { data: rawHistory, error: historyError } = await supabase
    .from("bot_chat_history")
    .select("role, content")
    .eq("bot_id", botId)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) {
    console.error("Failed to load history for bot", botId, "chat", chatId, ":", historyError.message);
  }

  const history: { role: string; content: string }[] = (rawHistory ?? []).reverse();

  // TW5: Guarantee current user message is in context even if DB insert failed above.
  // If the last message in history is not the user's current message, append it manually.
  const lastHistoryMsg = history[history.length - 1];
  if (!lastHistoryMsg || lastHistoryMsg.role !== "user" || lastHistoryMsg.content !== userText) {
    history.push({ role: "user", content: userText });
  }

  // TW7: Normalize history to ensure proper user/assistant alternation.
  // A failed assistant reply insertion leaves consecutive user messages that
  // OpenAI rejects with a 400 "invalid_request_error".  Merge them before use.
  const normalizedHistory = normalizeHistory(history);

  // Build messages array for the LLM
  // Prefer bot-level system_prompt; fall back to agent-level if bot has none
  const systemPrompt: string =
    ((bot.system_prompt as string) ?? "").trim() ||
    ((agent?.system_prompt as string) ?? "").trim();

  // Greeting fix: tell the model explicitly whether this is a new conversation
  const introRule = history.length === 0
    ? "This is the START of the conversation — you may introduce yourself briefly."
    : "Do NOT introduce yourself — this conversation is already in progress.";

  // Connector context (read data + write instructions) — fetched concurrently
  const connectorContext = connectors.length > 0
    ? await buildConnectorContext(connectors, supabaseUrl, serviceKey)
    : "";

  // 4-layer system prompt assembly:
  // Layer 1: BOT_SHELL_TEMPLATE — behavioral rules (module-level constant)
  // Layer 2: Wizard config — identity, name, description, commands  ┐ cached per bot
  // Layer 3: User system prompt — custom role & knowledge            ┘ (promptCache)
  // Layer 4 (dynamic): introRule + connectorContext — per-request, never cached
  let identityBlock = getCachedPrompt(botId);
  if (!identityBlock) {
    const wizardConfig = buildWizardConfig(bot, agent);
    identityBlock =
      wizardConfig +
      "\n\n## YOUR ROLE AND KNOWLEDGE:\n" +
      systemPrompt;
    setCachedPrompt(botId, identityBlock);
  }
  const finalSystemPrompt =
    BOT_SHELL_TEMPLATE +
    "\n\n" + introRule +
    "\n\n" + identityBlock +
    (connectorContext ? "\n\n" + connectorContext : "");

  const messages: { role: string; content: string }[] = [
    { role: "system", content: finalSystemPrompt },
    ...normalizedHistory,
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
    } else if (provider === "gemini" && placeholderMsgId) {
      // Gemini BYOK — real-time streaming with interim message edits
      reply = await callGeminiStreaming(messages, byokKey, botToken, chatId, placeholderMsgId);
      if (!reply) {
        // Streaming failed — fall back to non-streaming Gemini then Lovable
        const result = await callGemini(messages, byokKey);
        reply = result.content;
        if (!reply && result.shouldFallback && lovableKey) {
          console.log("BYOK streaming failed for bot", botId, "— falling back to Lovable AI");
          reply = await callLovableAi(messages, lovableKey);
        }
      }
    } else {
      // Anthropic or Gemini/OpenAI without streaming — keep typing indicator alive
      const typingAbort = new AbortController();
      keepTyping(botToken, chatId, typingAbort.signal);
      let result: { content: string | null; shouldFallback: boolean } = { content: null, shouldFallback: true };
      if (provider === "anthropic") {
        result = await callAnthropic(messages, byokKey);
      } else if (provider === "gemini") {
        result = await callGemini(messages, byokKey);
      } else {
        result = await callOpenAi(messages, byokKey);
      }
      typingAbort.abort();
      reply = result.content;
      if (!reply && result.shouldFallback && lovableKey) {
        console.log("BYOK failed for bot", botId, "— falling back to Lovable AI");
        const fallbackTypingAbort = new AbortController();
        keepTyping(botToken, chatId, fallbackTypingAbort.signal);
        reply = await callLovableAi(messages, lovableKey);
        fallbackTypingAbort.abort();
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
      const typingAbort = new AbortController();
      keepTyping(botToken, chatId, typingAbort.signal);
      reply = await callLovableAi(messages, lovableKey);
      typingAbort.abort();
    }
  }

  if (!reply) {
    const customFallback = (bot.fallback_message as string | null)?.trim();
    reply = customFallback || "⚠️ AI is temporarily unavailable. Please try again later.";
  }

  // Execute any [SAVE:...] connector write actions embedded in the AI reply
  if (connectors.length > 0 && reply.includes("[SAVE:")) {
    const { cleanReply, savedLines } = await executeConnectorWrites(reply, connectors, supabaseUrl, serviceKey);
    reply = cleanReply;
    // Append save confirmations inline if any (e.g. "✅ Saved to Google Sheets")
    if (savedLines.length > 0) {
      reply = reply + "\n\n" + savedLines.join("\n");
    }
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
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Extract botId from path: /functions/v1/telegram-webhook/<botId>
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const botId = pathParts[pathParts.length - 1];

  if (!botId || botId === "telegram-webhook") {
    return new Response(JSON.stringify({ error: "botId missing in URL path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
  let connectors: ConnectorRow[] = [];

  const cached = getCachedBot(botId);
  if (cached) {
    bot = cached.data;
    agent = cached.agent;
    connectors = cached.connectors;
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
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
        .select("name, description, about_text, telegram_display_name, telegram_short_description, telegram_about_text, telegram_commands, tone, openai_api_key, system_prompt")
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

      // Load connectors for this agent
      connectors = await loadConnectors(supabase, agentId);
    }

    setCachedBot(botId, mutable, agent, connectors);
    bot = mutable;
  }

  // ------------------------------------------------------------------
  // 2. Verify Telegram webhook secret
  // ------------------------------------------------------------------
  const incomingSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (bot.webhook_secret && incomingSecret !== bot.webhook_secret) {
    console.error("Webhook secret mismatch for bot:", botId);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ------------------------------------------------------------------
  // 3. Parse Telegram update
  // ------------------------------------------------------------------
  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ------------------------------------------------------------------
  // TW1: Respond immediately to Telegram (< 1 s), process in background.
  // EdgeRuntime.waitUntil() keeps the function alive until processing completes.
  // ------------------------------------------------------------------

  // Show typing indicator immediately — before any DB work starts (fire-and-forget)
  if (userText !== "/start") {
    fetch(`${TELEGRAM_API}/bot${bot.telegram_token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    }).catch(() => {});
  }

  const bgWork = processMessage(supabase, bot, agent, connectors, botId, chatId, userText, updateId, lovableKey, supabaseUrl, serviceKey);

  // @ts-ignore — EdgeRuntime is a Supabase/Deno edge-runtime global
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(bgWork);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
