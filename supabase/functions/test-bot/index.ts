import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const BYOK_FALLBACK_STATUSES = new Set([402, 403, 429]);

// DT2/S4: Restrict CORS to configured frontend origin.
// Set ALLOWED_ORIGIN env var to your Lovable/Vercel domain.
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
  };
}

async function callLovableAi(messages: any[], lovableKey: string) {
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
    const errText = await res.text();
    console.error("Lovable AI error:", res.status, errText);
    return { content: null, error: `AI error ${res.status}`, status: res.status };
  }
  const data = await res.json();
  return { content: data?.choices?.[0]?.message?.content ?? "", error: null, status: 200 };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt, openaiKey } = await req.json();

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const useByok = openaiKey && openaiKey.startsWith("sk-");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";

    if (useByok) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: apiMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("OpenAI BYOK error:", response.status, data?.error?.message);

        if (BYOK_FALLBACK_STATUSES.has(response.status) && lovableKey) {
          console.log("BYOK failed, falling back to Lovable AI");
          const fallback = await callLovableAi(apiMessages, lovableKey);
          if (fallback.content !== null) {
            return new Response(JSON.stringify({ content: fallback.content }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(JSON.stringify({ error: data?.error?.message || "OpenAI API error" }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify({
        content: data.choices[0].message.content,
        usage: data.usage,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No BYOK — use Lovable AI directly
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured. Provide an OpenAI API key or contact support." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callLovableAi(apiMessages, lovableKey);
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content: result.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
