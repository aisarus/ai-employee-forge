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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const { data, error } = await supabase.functions.invoke("llm-proxy", {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
        },
      });

      if (error) throw new Error(error.message || "Edge function error");
      if (data?.error) throw new Error(data.error);

      return data?.content ?? "";
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) continue;
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
