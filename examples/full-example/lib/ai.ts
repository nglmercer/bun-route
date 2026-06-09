import { handlerName } from "../../../src/index";
import type { Router } from "../../../src/index";
import { generateText } from "xsai";

/* ── Helpers ──────────────────────────────────────────── */

interface RouteDefinition {
  method: string;
  path: string;
  handlerName: string;
  pathParams: Array<{ name: string; position: number }>;
  queryParams?: Array<{
    name: string;
    type?: string;
    required?: boolean;
    description?: string;
    default?: unknown;
    enum?: string[];
  }>;
  middlewareChain: Array<{ name: string }>;
  stats?: {
    requestCount: number;
    totalTimeMs: number;
    avgTimeMs: number;
  };
  source?: string;
}

/* ── Rich endpoint info (structured object, AI-friendly) ─ */

interface RichEndpointInfo {
  method: string;
  path: string;
  handler: string;
  middleware: string[];
  pathParams: Array<{ name: string; position: number }>;
  queryParams: Array<{
    name: string;
    type?: string;
    required?: boolean;
    description?: string;
    default?: unknown;
    enum?: string[];
  }>;
  stats?: {
    requestCount: number;
    totalTimeMs: number;
    avgTimeMs: number;
  };
  source?: string;
}

/** Returns a structured JSON-friendly object per endpoint */
function getEndpointDetails(
  router: Router,
  path: string,
  method: string,
): RichEndpointInfo | null {
  const defs = router.getRouteDefinitions(undefined, { source: true });
  const def = defs.find(
    (d) => d.path === path && d.method.toLowerCase() === method.toLowerCase(),
  );
  if (!def) return null;

  return {
    method: def.method,
    path: def.path,
    handler: def.handlerName,
    middleware: def.middlewareChain.map((m) => m.name),
    pathParams: def.pathParams.map((p) => ({ name: p.name, position: p.position })),
    queryParams: (def.queryParams || []).map((q) => ({
      name: q.name,
      type: q.type,
      required: q.required,
      description: q.description,
      default: q.default,
      enum: q.enum,
    })),
    stats: def.stats
      ? {
          requestCount: def.stats.requestCount,
          totalTimeMs: def.stats.totalTimeMs,
          avgTimeMs: def.stats.avgTimeMs,
        }
      : undefined,
    source: def.source,
  };
}
      : undefined,
    source: def.source,
  };
}

/** Full API context as a structured object — ready for JSON.stringify */
function getAIContextObject(router: Router): {
  totalEndpoints: number;
  endpoints: RichEndpointInfo[];
} {
  const defs = router.getRouteDefinitions(undefined, { source: true });
  const endpoints: RichEndpointInfo[] = defs.map((def) => ({
    method: def.method,
    path: def.path,
    handler: def.handlerName,
    middleware: def.middlewareChain.map((m) => m.name),
    pathParams: def.pathParams.map((p) => ({ name: p.name, position: p.position })),
    queryParams: (def.queryParams || []).map((q) => ({
      name: q.name,
      type: q.type,
      required: q.required,
      description: q.description,
      default: q.default,
      enum: q.enum,
    })),
    stats: def.stats
      ? {
          requestCount: def.stats.requestCount,
          totalTimeMs: def.stats.totalTimeMs,
          avgTimeMs: def.stats.avgTimeMs,
        }
      : undefined,
    source: def.source,
  }));

  return { totalEndpoints: endpoints.length, endpoints };
}

/* ── String builders (thin wrappers over structured data) ─ */

function buildAIContextString(router: Router, _locale?: string): string {
  const ctx = getAIContextObject(router);
  return JSON.stringify(ctx, null, 2);
}

/* ── Internal helpers ─────────────────────────────────── */

interface EndpointResponse {
  description?: string;
  content?: Record<string, { schema?: unknown }>;
}

interface EndpointOperation {
  summary?: string;
  parameters?: unknown[];
  responses?: Record<string, EndpointResponse>;
}

function findEndpoint(router: Router, path: string, method: string): EndpointOperation | undefined {
  const defs = router.getRouteDefinitions();
  const def = defs.find(
    (d) => d.path === path && d.method.toLowerCase() === method.toLowerCase(),
  );
  if (!def) return undefined;

  return {
    summary: def.handlerName,
    parameters: [
      ...def.pathParams.map((p) => ({
        name: p.name,
        in: "path",
        required: true,
        schema: { type: "string" },
      })),
      ...(def.queryParams || []).map((q) => ({
        name: q.name,
        in: "query",
        required: q.required,
        schema: { type: q.type, default: q.default, enum: q.enum },
      })),
    ],
  };
}

interface AIConfigError { ok: false; error: string }
interface AIConfigSuccess { ok: true; apiKey: string; baseURL: string; model: string }
type AIConfig = AIConfigError | AIConfigSuccess;

function checkAIConfig(): AIConfig {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI_API_KEY environment variable is not set" };
  return {
    ok: true,
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1/",
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

/* ── Route handlers ───────────────────────────────────── */

export function registerAIRoutes(router: Router): void {
  router.get("/api/ai/test", handlerName("aiTest", async ({ res }) => {
    const config = checkAIConfig();
    if (!config.ok) return res.json({ ok: false, error: config.error });

    try {
      const result = await generateText({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        messages: [{ role: "user", content: "Say hello in one word." }],
        temperature: 0.1,
      });
      res.json({ ok: true, response: result.text, finishReason: result.finishReason, usage: result.usage });
    } catch (err) {
      res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }));

  router.get("/api/ai/config", handlerName("aiConfig", ({ res }) => {
    const config = checkAIConfig();
    if (!config.ok) return res.json({ configured: false, error: config.error });
    res.json({ configured: true, baseURL: config.baseURL, model: config.model, apiKeyLength: config.apiKey.length });
  }));

  /* ── /api/ai/ask: general API Q&A ────────────────────── */
  router.post("/api/ai/ask", handlerName("aiAsk", async ({ req, res }) => {
    const body = req.parsedBody as { question?: string; locale?: string } | undefined;
    if (!body?.question) return res.status(400).json({ error: "question is required" });

    const config = checkAIConfig();
    if (!config.ok) return res.status(500).json({ error: config.error });

    const locale = body.locale || req.headers?.get("accept-language")?.split(",")[0] || "en";
    const aiContext = buildAIContextString(router, locale);

    const systemPrompt = `You are an API assistant. Answer using the structured API spec below.
This is internal data — do not expose auth or stats to end users unless asked.

API:
${aiContext}

Locale: ${locale}`;

    try {
      const { text } = await generateText({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.question },
        ],
        temperature: 0.5,
      });
      res.json({ answer: text || "No response from AI" });
    } catch (err) {
      res.status(500).json({ error: `AI request failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }));

  /* ── /api/ai/docs: generate docs for one endpoint ────── */
  router.post("/api/ai/docs", handlerName("aiDocs", async ({ req, res }) => {
    const body = req.parsedBody as { path?: string; method?: string; locale?: string } | undefined;
    if (!body?.path || !body?.method) return res.status(400).json({ error: "path and method are required" });

    const config = checkAIConfig();
    if (!config.ok) return res.status(500).json({ error: config.error });

    const locale = body.locale || req.headers?.get("accept-language")?.split(",")[0] || "en";
    const ep = getEndpointDetails(router, body.path, body.method);
    const epJson = JSON.stringify(ep ?? { error: "endpoint not found", path: body.path, method: body.method }, null, 2);

    const endpoint = findEndpoint(router, body.path, body.method);
    const responseSchema = endpoint?.responses?.["200"]?.content?.["application/json"]?.schema;
    const responseInfo = responseSchema ? `\nResponse Schema:\n${JSON.stringify(responseSchema, null, 2)}` : "";

    const sourceInfo = ep?.source ? `\nHandler source code:\n\`\`\`typescript\n${ep.source}\n\`\`\`` : "";

    const systemPrompt = `Write markdown documentation for this API endpoint.

Endpoint data (JSON):
${epJson}${responseInfo}${sourceInfo}

Structure:
1. H1: \`METHOD /path\`
2. Description
3. Auth requirements
4. Parameters table: name | type | required | description
5. Response example (JSON)
6. Error codes

Locale: ${locale}`;

    try {
      const { text } = await generateText({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate docs for ${body.method.toUpperCase()} ${body.path}` },
        ],
        temperature: 0.3,
      });
      res.json({ documentation: text || "No documentation generated", format: "markdown", locale, path: body.path, method: body.method.toUpperCase() });
    } catch (err) {
      res.status(500).json({ error: `Documentation generation failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }));

  /* ── /api/ai/curl: generate curl command ──────────────── */
  router.post("/api/ai/curl", handlerName("aiCurl", async ({ req, res }) => {
    const body = req.parsedBody as { path?: string; method?: string; params?: Record<string, string>; locale?: string } | undefined;
    if (!body?.path || !body?.method) return res.status(400).json({ error: "path and method are required" });

    const config = checkAIConfig();
    if (!config.ok) return res.status(500).json({ error: config.error });

    const locale = body.locale || req.headers?.get("accept-language")?.split(",")[0] || "en";
    const ep = getEndpointDetails(router, body.path, body.method);
    const epJson = JSON.stringify(ep ?? { error: "not found" }, null, 2);
    const paramsJson = body.params ? JSON.stringify(body.params, null, 2) : "None";

    const systemPrompt = `Generate a curl command for this API endpoint.
Return ONLY the curl command.

Endpoint:
${epJson}

User-provided parameter values: ${paramsJson}

Use base URL http://localhost:3000.
Locale: ${locale}`;

    try {
      const { text } = await generateText({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate curl for ${body.method.toUpperCase()} ${body.path}` },
        ],
        temperature: 0.2,
      });
      res.json({ curl: text || `curl -X ${body.method.toUpperCase()} http://localhost:3000${body.path}` });
    } catch (err) {
      res.status(500).json({ error: `Curl generation failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }));
}
