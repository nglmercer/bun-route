import { handlerName } from "../../../src/index";
import type { Router } from "../../../src/index";
import type { RouteDefinition } from "../../../src/index";
import { generateText } from "xsai";

/* ── Types ────────────────────────────────────────────── */

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

interface AIConfigError {
  ok: false;
  error: string;
}

interface AIConfigSuccess {
  ok: true;
  apiKey: string;
  baseURL: string;
  model: string;
}

type AIConfig = AIConfigError | AIConfigSuccess;

interface AIReturn {
  ok: true;
  text: string;
  finishReason?: string;
  usage?: unknown;
}

interface AIError {
  ok: false;
  error: string;
}

/* ── Helpers ──────────────────────────────────────────── */

function routeDefToEndpointInfo(def: RouteDefinition): RichEndpointInfo {
  return {
    method: def.method,
    path: def.path,
    handler: def.handlerName,
    middleware: def.middlewareChain.map((m) => m.name),
    pathParams: def.pathParams.map((p) => ({
      name: p.name,
      position: p.position,
    })),
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

function getLocale(
  body: { locale?: string } | undefined,
  headers?: Headers,
): string {
  return body?.locale || headers?.get("accept-language")?.split(",")[0] || "en";
}

function checkAIConfig(): AIConfig {
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

async function callAI(
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

function findDef(
  defs: RouteDefinition[],
  path: string,
  method: string,
): RouteDefinition | undefined {
  return defs.find(
    (d) => d.path === path && d.method.toLowerCase() === method.toLowerCase(),
  );
}

/* ── Public API ───────────────────────────────────────── */

/** Returns a structured JSON-friendly object per endpoint */
export function getEndpointDetails(
  router: Router,
  path: string,
  method: string,
): RichEndpointInfo | null {
  const defs = router.getRouteDefinitions(undefined, { source: true });
  const def = findDef(defs, path, method);
  return def ? routeDefToEndpointInfo(def) : null;
}

/** Full API context as a structured object — ready for JSON.stringify */
function getAIContextObject(router: Router): {
  totalEndpoints: number;
  endpoints: RichEndpointInfo[];
} {
  const defs = router.getRouteDefinitions(undefined, { source: true });
  const endpoints = defs.map(routeDefToEndpointInfo);
  return { totalEndpoints: endpoints.length, endpoints };
}

function buildAIContextString(router: Router, _locale?: string): string {
  return JSON.stringify(getAIContextObject(router), null, 2);
}

/* ── Route handlers ───────────────────────────────────── */

export function registerAIRoutes(router: Router): void {
  router.get(
    "/api/ai/config",
    handlerName("aiConfig", ({ res }) => {
      const config = checkAIConfig();
      if (!config.ok)
        return res.json({ configured: false, error: config.error });
      res.json({
        configured: true,
        baseURL: config.baseURL,
        model: config.model,
        apiKeyLength: config.apiKey.length,
      });
    }),
  );

  router.post(
    "/api/ai/ask",
    handlerName("aiAsk", async ({ req, res }) => {
      const body = req.parsedBody as
        | { question?: string; locale?: string }
        | undefined;
      if (!body?.question)
        return res.status(400).json({ error: "question is required" });

      const config = checkAIConfig();
      if (!config.ok) return res.status(500).json({ error: config.error });

      const locale = getLocale(body, req.headers);
      const aiContext = buildAIContextString(router, locale);

      const result = await callAI(
        config,
        [
          {
            role: "system",
            content: `You are an API assistant. Answer using the structured API spec below.
This is internal data — do not expose auth or stats to end users unless asked.

API:
${aiContext}

Locale: ${locale}`,
          },
          { role: "user", content: body.question },
        ],
        0.5,
      );

      if (!result.ok)
        return res
          .status(500)
          .json({ error: `AI request failed: ${result.error}` });
      res.json({ answer: result.text || "No response from AI" });
    }),
  );

  router.post(
    "/api/ai/docs",
    handlerName("aiDocs", async ({ req, res }) => {
      const body = req.parsedBody as
        | { path?: string; method?: string; locale?: string }
        | undefined;
      if (!body?.path || !body?.method)
        return res.status(400).json({ error: "path and method are required" });

      const config = checkAIConfig();
      if (!config.ok) return res.status(500).json({ error: config.error });

      const locale = getLocale(body, req.headers);
      const ep = getEndpointDetails(router, body.path, body.method);
      const epJson = JSON.stringify(
        ep ?? {
          error: "endpoint not found",
          path: body.path,
          method: body.method,
        },
        null,
        2,
      );

      const sourceInfo = ep?.source
        ? `\nHandler source code:\n\`\`\`typescript\n${ep.source}\n\`\`\``
        : "";

      const result = await callAI(
        config,
        [
          {
            role: "system",
            content: `Write markdown documentation for this API endpoint.

Endpoint data (JSON):
${epJson}${sourceInfo}

Structure:
1. H1: \`METHOD /path\`
2. Description
3. Auth requirements
4. Parameters table: name | type | required | description
5. Response example (JSON)
6. Error codes

Locale: ${locale}`,
          },
          {
            role: "user",
            content: `Generate docs for ${body.method.toUpperCase()} ${body.path}`,
          },
        ],
        0.3,
      );

      if (!result.ok)
        return res.status(500).json({
          error: `Documentation generation failed: ${result.error}`,
        });
      res.json({
        documentation: result.text || "No documentation generated",
        format: "markdown",
        locale,
        path: body.path,
        method: body.method.toUpperCase(),
      });
    }),
  );

  router.post(
    "/api/ai/schema",
    handlerName("aiSchema", async ({ req, res }) => {
      const body = req.parsedBody as
        | { path?: string; method?: string; locale?: string }
        | undefined;
      if (!body?.path || !body?.method)
        return res.status(400).json({ error: "path and method are required" });

      const config = checkAIConfig();
      if (!config.ok) return res.status(500).json({ error: config.error });

      const locale = getLocale(body, req.headers);
      const ep = getEndpointDetails(router, body.path, body.method);
      const epJson = JSON.stringify(
        ep ?? { error: "endpoint not found", path: body.path, method: body.method },
        null,
        2,
      );

      const sourceInfo = ep?.source
        ? `\nHandler source code:\n\`\`\`typescript\n${ep.source}\n\`\`\``
        : "";

      const result = await callAI(
        config,
        [
          {
            role: "system",
            content: `Generate an OpenAPI 3.0 compatible JSON schema for this API endpoint.
Return ONLY valid JSON (no markdown, no explanation).

Endpoint data:
${epJson}${sourceInfo}

Output structure:
{
  "openapi": "3.0.3",
  "info": { "title": "...", "version": "1.0.0" },
  "paths": {
    "<path>": {
      "<method>": {
        "summary": "...",
        "parameters": [...],
        "requestBody": { ... },
        "responses": { "200": { ... }, "400": { ... }, "500": { ... } }
      }
    }
  }
}

Include:
- path parameters with schema
- query parameters with schema and defaults
- request body schema if method is POST/PUT/PATCH
- response schemas with example values
- error response schemas (400, 500)

Locale: ${locale}`,
          },
          {
            role: "user",
            content: `Generate OpenAPI schema for ${body.method.toUpperCase()} ${body.path}`,
          },
        ],
        0.2,
      );

      if (!result.ok)
        return res.status(500).json({
          error: `Schema generation failed: ${result.error}`,
        });

      let schema: unknown;
      try {
        schema = JSON.parse(result.text);
      } catch {
        schema = { raw: result.text, format: "text" };
      }

      res.json({
        schema,
        format: "openapi-3.0",
        locale,
        path: body.path,
        method: body.method.toUpperCase(),
      });
    }),
  );
}
