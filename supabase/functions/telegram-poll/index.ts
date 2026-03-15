import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";
const OPENAI_API = "https://api.openai.com/v1/chat/completions";
// Leave ~5 s buffer before the function's 60 s limit
const MAX_RUNTIME_MS = 55_000;

Deno.serve(async () => {
  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const defaultOpenAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Get all active Telegram agents ─────────────────────────────────────────
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .eq("platform", "telegram")
    .eq("is_active", true);

  if (agentsError) {
    return new Response(JSON.stringify({ error: agentsError.message }), { status: 500 });
  }
  if (!agents || agents.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No active agents", processed: 0 }));
  }

  let totalProcessed = 0;

  // ── Process each agent in turn ─────────────────────────────────────────────
  for (const agent of agents as any[]) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    try {
      const botToken: string = (agent.telegram_token || "").trim();
      const openaiKey: string = (agent.openai_api_key || defaultOpenAiKey || "").trim();

      if (!botToken || !openaiKey) continue; // skip misconfigured agents

      // Per-agent offset from already stored messages (schema-safe, no extra column needed)
      const { data: lastUpdateRow } = await supabase
        .from("telegram_messages")
        .select("update_id")
        .eq("agent_id", agent.id)
        .order("update_id", { ascending: false })
        .limit(1)
        .maybeSingle();

      const offset = lastUpdateRow?.update_id ? Number(lastUpdateRow.update_id) + 1 : 0;

      // One short-poll per agent (timeout=3 to not block too long)
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

          // Store incoming update first
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

          // Only text messages go to LLM
          if (!userText) continue;

          // Get recent chat history for context (same chat + same agent)
          const { data: history } = await supabase
            .from("telegram_messages")
            .select("text, raw_update")
            .eq("agent_id", agent.id)
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })
            .limit(10);

          const systemPrompt = (agent.system_prompt || "").toString();
          const hasExplicitLanguage =
            /always respond in |всегда отвечай на |язык ответ|response language|LANGUAGE[:\s]/i.test(systemPrompt);
          const languageRule = hasExplicitLanguage
            ? ""
            : "\n\nIMPORTANT: Always respond in the same language the user writes to you.";

          const chatMessages = [
            { role: "system", content: systemPrompt + languageRule },
            ...(history || []).slice(-8).map((m: any) => ({
              role: m.raw_update?.message?.from?.is_bot ? "assistant" : "user",
              content: m.text || "",
            })),
            { role: "user", content: userText },
          ];

          let reply = "Sorry, I couldn't process that.";
          try {
            const openaiRes = await fetch(OPENAI_API, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: chatMessages,
                temperature: 0.7,
              }),
            });
            const openaiData = await openaiRes.json().catch(() => ({}));
            reply = openaiData?.choices?.[0]?.message?.content || reply;
          } catch (err) {
            console.error("OpenAI error for agent", agent.id, err);
          }

          // Send plain text reply (no parse_mode to avoid HTML parse errors)
          await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: reply }),
          }).catch(() => null);

          totalProcessed++;
        } catch (messageError) {
          console.error("Error processing message:", messageError);
        }
      }
    } catch (agentError) {
      console.error("Error processing agent:", agent?.id, agentError);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed }));
});