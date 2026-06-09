import { generateText } from "xsai";

export interface AIReturn {
  ok: true;
  text: string;
  finishReason?: string;
  usage?: unknown;
}

export interface AIError {
  ok: false;
  error: string;
}

export interface AIConfigError {
  ok: false;
  error: string;
}

export interface AIConfigSuccess {
  ok: true;
  apiKey: string;
  baseURL: string;
  model: string;
}

export type AIConfig = AIConfigError | AIConfigSuccess;

export function checkAIConfig(): AIConfig {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey)
    return { ok: false, error: "AI_API_KEY environment variable is not set" };
  return {
    ok: true,
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1/",
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

export function getLocale(
  body: { locale?: string } | undefined,
  headers?: Headers,
): string {
  return body?.locale || headers?.get("accept-language")?.split(",")[0] || "en";
}

export async function callAI(
  config: AIConfigSuccess,
  messages: Array<{ role: "user" | "system"; content: string }>,
  temperature: number,
): Promise<AIReturn | AIError> {
  try {
    const result = await generateText({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      messages,
      temperature,
    });
    return {
      ok: true,
      text: result.text || "",
      finishReason: result.finishReason,
      usage: result.usage,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
