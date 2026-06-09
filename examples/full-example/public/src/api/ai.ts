import { apiFetch } from "./client";

export async function askAI(question: string): Promise<string> {
  const res = await apiFetch<{ answer?: string; error?: string }>(
    "/api/ai/ask",
    {
      method: "POST",
      body: { question },
    }
  );
  if (res.data.error) throw new Error(res.data.error);
  return res.data.answer || "";
}

export async function generateDocs(
  path: string,
  method: string
): Promise<string> {
  const res = await apiFetch<{ documentation?: string; error?: string }>(
    "/api/ai/docs",
    {
      method: "POST",
      body: { path, method },
    }
  );
  if (res.data.error) throw new Error(res.data.error);
  return res.data.documentation || "";
}

export async function generateCurl(
  path: string,
  method: string,
  params?: Record<string, string>
): Promise<string> {
  const res = await apiFetch<{ curl?: string; error?: string }>(
    "/api/ai/curl",
    {
      method: "POST",
      body: { path, method, params },
    }
  );
  if (res.data.error) throw new Error(res.data.error);
  return res.data.curl || "";
}

export async function generateBody(
  path: string,
  method: string,
  params?: Array<{ name: string; in: string; required?: boolean; schema?: { type?: string; enum?: string[] } }>
): Promise<string> {
  const paramsList = params
    ?.map((p) => `- ${p.name} (${p.in}, type: ${p.schema?.type || "string"}${p.required ? ", required" : ""})`)
    .join("\n") || "No parameters defined";

  const question = `Generate a JSON request body for a ${method.toUpperCase()} request to ${path}.

Parameters:
${paramsList}

Return ONLY a valid JSON object with appropriate example values. No explanation, no markdown.`;

  const answer = await askAI(question);

  const jsonMatch = answer.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return answer;
    }
  }
  return answer;
}
