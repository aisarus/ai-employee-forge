import { supabase } from "@/integrations/supabase/client";

export interface LlmOptions {
  apiKey?: string; // kept for interface compat, not used
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  opts: LlmOptions
): Promise<string> {
  const { temperature = 0.4, maxRetries = 3 } = opts;

  const userOpenAiKey = localStorage.getItem("userOpenAiKey");
  const useDirectOpenAi = userOpenAiKey && userOpenAiKey.startsWith("sk-");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      if (useDirectOpenAi) {
        if (attempt === 0) console.log('[TRI-TFM] useDirectOpenAi=true, calling OpenAI directly');
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userOpenAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg = err?.error?.message || `OpenAI error ${response.status}`;
          console.error(`[TRI-TFM] OpenAI fetch error (attempt ${attempt + 1}):`, msg);
          throw new Error(msg);
        }

        const json = await response.json();
        return json.choices?.[0]?.message?.content ?? "";
      } else {
        if (attempt === 0) console.log('[TRI-TFM] useDirectOpenAi=false, calling llm-proxy edge function');
        const { data, error } = await supabase.functions.invoke("llm-proxy", {
          body: {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature,
          },
        });

        if (error) {
          console.error(`[TRI-TFM] llm-proxy edge function error (attempt ${attempt + 1}):`, error.message);
          throw new Error(error.message || "Edge function error");
        }
        if (data?.error) {
          console.error(`[TRI-TFM] llm-proxy returned error (attempt ${attempt + 1}):`, data.error);
          throw new Error(data.error);
        }

        return data?.content ?? "";
      }
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) {
        console.warn(`[TRI-TFM] LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying:`, e.message);
        continue;
      }
    }
  }

  throw lastError ?? new Error("LLM call failed");
}

export function parseLlmJson<T>(raw: string, fallback: T): T {
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
