import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryDecrypt } from "../_shared/crypto.ts";

const TELEGRAM_API = "https://api.telegram.org";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const MAX_RUNTIME_MS = 55_000;
const BYOK_FALLBACK_STATUSES = new Set([402, 403, 429]);

async function callLovableAi(messages: any[], lovableKey: string): Promise<string | null> {
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      messages,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    console.error("Lovable AI error, status:", res.status, "body:", await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content || null;
}

async function callOpenAi(messages: any[], apiKey: string): Promise<{ content: string | null; fallback: boolean }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("OpenAI error, status:", res.status, "body:", errBody);
    return { content: null, fallback: BYOK_FALLBACK_STATUSES.has(res.status) };
  }
  const data = await res.json().catch(() => ({}));
  return { content: data?.choices?.[0]?.message?.content || null, fallback: false };
}

Deno.serve(async () => {
  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, system_prompt, telegram_token, openai_api_key, telegram_update_offset, welcome_message, starter_buttons")
    .eq("platform", "telegram")
    .eq("is_active", true);

  if (agentsError) {
    return new Response(JSON.stringify({ error: agentsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!agents || agents.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No active agents", processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let totalProcessed = 0;

  for (const agent of agents as any[]) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    try {
      // S1/S2: Decrypt credentials stored encrypted in DB
      const botToken: string = agent.telegram_token
        ? (await tryDecrypt(agent.telegram_token)).trim()
        : "";
      if (!botToken) continue;

      const agentOpenaiKey: string = agent.openai_api_key
        ? (await tryDecrypt(agent.openai_api_key)).trim()
        : "";

      // Need at least one AI provider
      if (!agentOpenaiKey && !lovableKey) continue;

      const { data: lastUpdateRow } = await supabase
        .from("telegram_messages")
        .select("update_id")
        .eq("agent_id", agent.id)
        .order("update_id", { ascending: false })
        .limit(1)
        .maybeSingle();

      const offset = lastUpdateRow?.update_id ? Number(lastUpdateRow.update_id) + 1 : 0;

      const updatesRes = await fetch(`${TELEGRAM_API}/bot${botToken}/getUpdates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset, timeout: 3, allowed_updates: ["message"] }),
      }).catch(() => null);

      if (!updatesRes || !updatesRes.ok) continue;

      const updatesData = await updatesRes.json().catch(() => null);
      if (!updatesData?.result?.length) continue;

      const updates: any[] = updatesData.result;

      for (const update of updates) {
        try {
          const chatId: number | undefined = update?.message?.chat?.id;
          const userText: string | null = update?.message?.text ?? null;

          if (!chatId) continue;

          await supabase.from("telegram_messages").upsert(
            {
              update_id: update.update_id,
              agent_id: agent.id,
              chat_id: chatId,
              text: userText,
              raw_update: update,
            },
            { onConflict: "update_id" }
          );

          if (!userText) continue;

          if (userText === "/start") {
            let startReply = agent.welcome_message || "Welcome! How can I assist you?";
            const replyMarkup: any = {};

            if (agent.starter_buttons && Array.isArray(agent.starter_buttons) && agent.starter_buttons.length > 0) {
              replyMarkup.inline_keyboard = agent.starter_buttons.map((button: any) => [{
                text: button.text,
                callback_data: button.data || button.text,
              }]);
            }

            await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: startReply,
                parse_mode: "HTML",
                reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined,
              }),
            }).catch(() => null);

            // Skip further processing for /start command
            totalProcessed++;
            continue;
          }

          // Build conversation history from stored messages (both user and bot)
          const { data: history } = await supabase
            .from("telegram_messages")
            .select("text, raw_update")
            .eq("agent_id", agent.id)
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })
            .limit(30);

          const systemPrompt = (agent.system_prompt || "").toString();
          const hasExplicitLanguage =
            /always respond in |всегда отвечай на |язык ответ|response language|LANGUAGE[:\s]/i.test(systemPrompt);
          const languageRule = hasExplicitLanguage
            ? ""
            : "\n\nIMPORTANT: Always respond in the same language the user writes to you.";

          // Build messages array with proper role assignment
          const chatMessages: { role: string; content: string }[] = [
            { role: "system", content: systemPrompt + languageRule },
          ];

          for (const m of (history || []).slice(-30)) {
            const isBotReply = m.raw_update && (m.raw_update as any).__bot_reply === true;
            chatMessages.push({
              role: isBotReply ? "assistant" : "user",
              content: m.text || "",
            });
          }

          let reply: string | null = null;

          if (agentOpenaiKey) {
            const result = await callOpenAi(chatMessages, agentOpenaiKey);
            reply = result.content;

            if (!reply && result.fallback && lovableKey) {
              console.log("BYOK failed for agent", agent.id, "— falling back to Lovable AI");
              reply = await callLovableAi(chatMessages, lovableKey);
            }
          } else if (lovableKey) {
            reply = await callLovableAi(chatMessages, lovableKey);
          }

          if (!reply) {
            reply = "⚠️ AI is temporarily unavailable. Please try again later.";
          }

          // Send reply to Telegram
          await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: reply }),
          }).catch(() => null);

          // Save bot reply to history so future conversations have full context
          const botUpdateId = update.update_id * 10 + 1; // synthetic unique ID
          await supabase.from("telegram_messages").upsert(
            {
              update_id: botUpdateId,
              agent_id: agent.id,
              chat_id: chatId,
              text: reply,
              raw_update: { __bot_reply: true, in_reply_to: update.update_id },
            },
            { onConflict: "update_id" }
          ).catch((e: any) => console.error("Failed to save bot reply:", e));

          totalProcessed++;
        } catch (messageError) {
          console.error("Error processing message:", messageError);
        }
      }
    } catch (agentError) {
      console.error("Error processing agent:", agent?.id, agentError);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed }), {
    headers: { "Content-Type": "application/json" },
  });
});
