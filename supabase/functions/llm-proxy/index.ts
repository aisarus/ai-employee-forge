import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { tryDecrypt } from "../_shared/crypto.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Validate OpenAI key format after decryption. */
function isValidOpenAiKey(key: string): boolean {
  return /^sk-[A-Za-z0-9_-]{45,}$/.test(key);
}

// DT2/S4: Restrict CORS to configured frontend origin.
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const isAllowed =
    (allowedOrigin !== "" && origin === allowedOrigin) ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("https://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (allowedOrigin || "null"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, temperature = 0.4, model = "google/gemini-2.5-flash", openaiKey: rawOpenaiKey } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt key in case it was stored encrypted in the DB and passed through.
    const openaiKey = rawOpenaiKey ? (await tryDecrypt(String(rawOpenaiKey))).trim() : "";
    const useByok = openaiKey && isValidOpenAiKey(openaiKey);

    if (useByok) {
      const byokRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature }),
      });
      if (byokRes.ok) {
        const byokData = await byokRes.json();
        return new Response(JSON.stringify({ content: byokData.choices[0].message.content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.warn("BYOK failed, falling back to Lovable AI:", byokRes.status);
    }

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({ model, messages, temperature }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI gateway error:", res.status, errText);
      return new Response(JSON.stringify({ error: `AI error ${res.status}` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
