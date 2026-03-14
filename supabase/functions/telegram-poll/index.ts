import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

Deno.serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;
  let currentOffset: number;

  // Read initial offset
  const { data: state, error: stateErr } = await supabase
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), { status: 500 });
  }

  currentOffset = state.update_offset;

  // Get all active telegram agents
  const { data: activeAgents } = await supabase
    .from("agents")
    .select("id, system_prompt, user_id")
    .eq("platform", "telegram")
    .eq("is_active", true);

  if (!activeAgents || activeAgents.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No active agents", processed: 0 }));
  }

  // Poll continuously until time runs out
  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;

    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ["message"],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), { status: 502 });
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    // Process each message
    for (const update of updates) {
      if (!update.message?.text) continue;

      const chatId = update.message.chat.id;
      const userText = update.message.text;

      // Use the first active agent (multi-agent routing can be added later)
      const agent = activeAgents[0];

      // Store incoming message
      await supabase.from("telegram_messages").upsert({
        update_id: update.update_id,
        agent_id: agent.id,
        chat_id: chatId,
        text: userText,
        raw_update: update,
      }, { onConflict: "update_id" });

      // Get chat history for context
      const { data: history } = await supabase
        .from("telegram_messages")
        .select("text, raw_update")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(10);

      // Build messages for OpenAI (using the user's OpenAI key stored... 
      // For now, use a simple response via the test-bot edge function)
      // We'll call OpenAI directly here for simplicity
      try {
        // Call test-bot function internally
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const testBotUrl = `${supabaseUrl}/functions/v1/test-bot`;
        
        // Get the user's OpenAI key from their agent config
        // For MVP, we use the agent's system prompt directly
        const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
        
        if (!openaiKey) {
          // Send a message telling the user to configure OpenAI key
          await fetch(`${GATEWAY_URL}/sendMessage`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TELEGRAM_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: "⚠️ Bot is not fully configured yet. OpenAI API key needed.",
              parse_mode: "HTML",
            }),
          });
          continue;
        }

        // Call OpenAI
        const chatMessages = [
          { role: "system", content: agent.system_prompt },
          ...(history || []).slice(-8).map((m: any) => ({
            role: m.raw_update?.message?.from?.is_bot ? "assistant" : "user",
            content: m.text || "",
          })),
          { role: "user", content: userText },
        ];

        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: chatMessages,
            temperature: 0.7,
          }),
        });

        const openaiData = await openaiResponse.json();
        const reply = openaiData.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";

        // Send reply via Telegram
        await fetch(`${GATEWAY_URL}/sendMessage`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: reply,
            parse_mode: "HTML",
          }),
        });

        // Increment message count
        await supabase.rpc("increment_message_count" as any, { agent_id_input: agent.id }).catch(() => {});

        totalProcessed++;
      } catch (err) {
        console.error("Error processing message:", err);
      }
    }

    // Advance offset
    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }));
});
