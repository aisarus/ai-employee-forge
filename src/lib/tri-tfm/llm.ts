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

  const userApiKey = localStorage.getItem("userOpenAiKey");
  const isOpenAi = userApiKey && userApiKey.startsWith("sk-") && !userApiKey.startsWith("sk-ant-");
  const isAnthropic = userApiKey && userApiKey.startsWith("sk-ant-");
  const isGemini = userApiKey && userApiKey.startsWith("AIza");
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      if (isOpenAi) {
        if (attempt === 0) console.log('[TRI-TFM] calling OpenAI directly');
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userApiKey}`,
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
          throw new Error(`OpenAI API Error: ${msg}`);
        }

        const json = await response.json();
        return json.choices?.[0]?.message?.content ?? "";
      } else if (isAnthropic) {
        if (attempt === 0) console.log('[TRI-TFM] calling Anthropic directly');
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": userApiKey!,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg = err?.error?.message || `Anthropic error ${response.status}`;
          console.error(`[TRI-TFM] Anthropic fetch error (attempt ${attempt + 1}):`, msg);
          throw new Error(`Anthropic API Error: ${msg}`);
        }

        const data = await response.json();
        return data.content?.[0]?.text ?? "";
      } else if (isGemini) {
        if (attempt === 0) console.log('[TRI-TFM] calling Gemini directly');
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${userApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg = err?.error?.message || `Gemini error ${response.status}`;
          console.error(`[TRI-TFM] Gemini fetch error (attempt ${attempt + 1}):`, msg);
          throw new Error(`Gemini API Error: ${msg}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } else {
        if (attempt === 0) console.log('[TRI-TFM] no BYOK key detected, calling llm-proxy edge function');
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



