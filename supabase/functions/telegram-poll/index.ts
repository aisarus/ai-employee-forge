import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_RUNTIME_MS = 55_000;

Deno.serve(async () => {
  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  for (const agent of agents as any[]) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    try {
      const botToken: string = (agent.telegram_token || "").trim();
      if (!botToken) continue;

      // Use agent's own OpenAI key if provided, otherwise use Lovable AI
      const agentOpenaiKey: string = (agent.openai_api_key || "").trim();
      const useLovableAi = !agentOpenaiKey;

      if (!useLovableAi && !agentOpenaiKey) continue;
      if (useLovableAi && !lovableKey) continue;

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
            if (useLovableAi) {
              // Use Lovable AI Gateway
              const aiRes = await fetch(LOVABLE_AI_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${lovableKey}`,
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: chatMessages,
                  temperature: 0.7,
                }),
              });
              const aiData = await aiRes.json().catch(() => ({}));
              reply = aiData?.choices?.[0]?.message?.content || reply;
            } else {
              // Use agent's own OpenAI key (BYOK)
              const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${agentOpenaiKey}`,
                },
                body: JSON.stringify({
                  model: "gpt-4o-mini",
                  messages: chatMessages,
                  temperature: 0.7,
                }),
              });
              const openaiData = await openaiRes.json().catch(() => ({}));
              reply = openaiData?.choices?.[0]?.message?.content || reply;
            }
          } catch (err) {
            console.error("AI error for agent", agent.id, err);
          }

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
