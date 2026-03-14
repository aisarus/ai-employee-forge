export interface LlmOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

const RETRYABLE_CODES = [429, 402, 500, 502, 503];

export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  opts: LlmOptions
): Promise<string> {
  const { apiKey, model = "gpt-4o-mini", temperature = 0.4, maxRetries = 4 } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000) + Math.random() * 1000;
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
        }),
      });

      if (!res.ok) {
        const status = res.status;
        if (RETRYABLE_CODES.includes(status) && attempt < maxRetries) {
          lastError = new Error(`HTTP ${status}`);
          continue;
        }
        const body = await res.text();
        throw new Error(`OpenAI API error ${status}: ${body}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) continue;
    }
  }

  throw lastError ?? new Error("LLM call failed");
}

export function parseLlmJson<T>(raw: string, fallback: T): T {
  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
