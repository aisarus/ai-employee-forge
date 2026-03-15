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
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Get all active Telegram agents ─────────────────────────────────────────
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, system_prompt, telegram_token, openai_api_key, telegram_update_offset")
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
  for (const agent of agents) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    const botToken: string = agent.telegram_token || "";
    const openaiKey: string = agent.openai_api_key || "";

    if (!botToken || !openaiKey) continue; // skip misconfigured agents

    let offset: number = agent.telegram_update_offset ?? 0;

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
      if (!update.message?.text) continue;

      const chatId: number = update.message.chat.id;
      const userText: string = update.message.text;

      // Store incoming message
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

      // Get recent chat history for context
      const { data: history } = await supabase
        .from("telegram_messages")
        .select("text, raw_update")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(10);

      // Build messages for OpenAI
      const hasExplicitLanguage =
        /always respond in |всегда отвечай на |язык ответ|response language|LANGUAGE[:\s]/i.test(
          agent.system_prompt
        );
      const languageRule = hasExplicitLanguage
        ? ""
        : "\n\nIMPORTANT: Always respond in the same language the user writes to you.";

      const chatMessages = [
        { role: "system", content: agent.system_prompt + languageRule },
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
        const openaiData = await openaiRes.json();
        reply = openaiData.choices?.[0]?.message?.content || reply;
      } catch (err) {
        console.error("OpenAI error for agent", agent.id, err);
      }

      // Send reply via this agent's bot token
      await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: "HTML" }),
      }).catch(() => null);

      await supabase.rpc("increment_message_count" as any, { agent_id_input: agent.id }).catch(() => {});
      totalProcessed++;
    }

    // Advance per-agent offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("agents")
      .update({ telegram_update_offset: newOffset })
      .eq("id", agent.id);
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed }));
});
