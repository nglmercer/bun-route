import { handlerName } from "../../../src/index";
import type { Router } from "../../../src/index";
import { generateText } from "xsai";

interface CachedSpec {
  spec: Record<string, unknown>;
  timestamp: number;
}

let cachedEnhancedSpec: CachedSpec | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function getOpenAPISpec(router: Router): Record<string, unknown> {
  const defs = router.getRouteDefinitions();
  const paths: Record<string, Record<string, unknown>> = {};
  for (const def of defs) {
    const swaggerPath = def.path.replace(/:(\w+)/g, "{$1}");
    if (!paths[swaggerPath]) paths[swaggerPath] = {};
    paths[swaggerPath][def.method.toLowerCase()] = {
      summary: def.handlerName,
      parameters: [
        ...def.pathParams.map((p) => ({
          name: p.name,
          in: "path" as const,
          required: true,
          schema: { type: "string" },
        })),
        ...(def.queryParams || []).map((p) => ({
          name: p.name,
          in: "query" as const,
          required: p.required,
          description: p.description,
          schema: { type: p.type, default: p.default, enum: p.enum },
        })),
      ],
    };
  }
  return {
    openapi: "3.0.0",
    info: { title: "router-bun API", version: "1.0.0" },
    paths,
  };
}

function getEndpointDetails(router: Router, path: string, method: string) {
  const defs = router.getRouteDefinitions();
  const normalizedPath = path.replace(/\{(\w+)\}/g, ":$1");

  for (const def of defs) {
    const defNormalized = def.path.replace(/\{(\w+)\}/g, ":$1");
    if (
      defNormalized === normalizedPath &&
      def.method.toLowerCase() === method.toLowerCase()
    ) {
      return {
        handlerName: def.handlerName,
        pathParams: def.pathParams,
        queryParams: def.queryParams || [],
        middleware: def.middlewareChain.map((m) => m.name),
      };
    }
  }
  return null;
}

function buildEndpointContext(
  router: Router,
  path: string,
  method: string,
): string {
  const endpoint = getEndpointDetails(router, path, method);
  if (!endpoint) return `Endpoint: ${method.toUpperCase()} ${path}`;

  const lines = [
    `Endpoint: ${method.toUpperCase()} ${path}`,
    `Handler: ${endpoint.handlerName}`,
    "",
  ];

  if (endpoint.pathParams.length > 0) {
    lines.push("Path Parameters:");
    for (const p of endpoint.pathParams) {
      lines.push(`  - ${p.name} (type: string, position: ${p.position})`);
    }
    lines.push("");
  }

  if (endpoint.queryParams.length > 0) {
    lines.push("Query Parameters:");
    for (const p of endpoint.queryParams) {
      const enumStr = p.enum ? `, enum: [${p.enum.join(", ")}]` : "";
      const defaultStr =
        p.default !== undefined ? `, default: ${p.default}` : "";
      lines.push(
        `  - ${p.name} (type: ${p.type}, required: ${p.required}${enumStr}${defaultStr})`,
      );
    }
    lines.push("");
  }

  if (endpoint.middleware.length > 0) {
    lines.push(`Middleware: ${endpoint.middleware.join(" → ")}`);
  }

  return lines.join("\n");
}

export async function enrichOpenAPISpec(
  router: Router,
  locale?: string,
): Promise<Record<string, unknown>> {
  if (
    cachedEnhancedSpec &&
    Date.now() - cachedEnhancedSpec.timestamp < CACHE_TTL
  ) {
    return cachedEnhancedSpec.spec;
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return getOpenAPISpec(router);
  }

  const baseSpec = getOpenAPISpec(router);
  const paths = baseSpec.paths as Record<string, Record<string, unknown>>;

  const endpointsList: string[] = [];
  for (const [path, methods] of Object.entries(paths)) {
    for (const method of Object.keys(methods)) {
      const context = buildEndpointContext(router, path, method);
      endpointsList.push(context);
    }
  }

  const systemPrompt = `You are an API documentation expert for a Bun HTTP router application.

TASK: Generate OpenAPI 3.0 response schemas for each API endpoint listed below.

RESPONSE FORMAT: Return ONLY a valid JSON object (no markdown, no explanation):
{
  "responses": {
    "METHOD /path": {
      "description": "Short description of what this endpoint returns",
      "schema": {
        "type": "object",
        "properties": {
          "fieldName": { "type": "string" }
        }
      }
    }
  }
}

RULES:
1. For GET /collection (no :id) → return object with "data" array + pagination fields
2. For GET /collection/:id → return single object
3. For POST /collection → return created object with "id" field
4. For PUT/PATCH /collection/:id → return updated object
5. For DELETE /collection/:id → return { "message": "deleted" }
6. Always include "id" field (type: string) for object responses
7. Use realistic field names based on the endpoint context
8. Keep descriptions short (under 50 words)
9. Use locale: ${locale || "en"} for descriptions

ENDPOINTS:
${endpointsList.join("\n---\n")}`;

  try {
    const { text } = await generateText({
      apiKey,
      baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1/",
      model: process.env.AI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: "Generate response schemas for all endpoints.",
        },
      ],
      temperature: 0.2,
    });

    console.log("[AI Enrich] Raw response length:", text?.length || 0);

    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI Enrich] No JSON found in response");
      return baseSpec;
    }

    const aiResponse = JSON.parse(jsonMatch[0]);
    const responses = aiResponse.responses as Record<
      string,
      { description?: string; schema?: unknown }
    >;

    if (!responses) {
      console.error("[AI Enrich] No 'responses' key in AI response");
      return baseSpec;
    }

    for (const [key, response] of Object.entries(responses)) {
      const spaceIdx = key.indexOf(" ");
      if (spaceIdx === -1) continue;

      const method = key.substring(0, spaceIdx).toLowerCase();
      const path = key.substring(spaceIdx + 1);
      const normalizedPath = path.replace(/\{(\w+)\}/g, ":$1");

      for (const [specPath, methods] of Object.entries(paths)) {
        const normalizedSpecPath = specPath.replace(/\{(\w+)\}/g, ":$1");
        if (normalizedSpecPath === normalizedPath && methods[method]) {
          const op = methods[method] as Record<string, unknown>;
          op.responses = {
            "200": {
              description: response.description || "Successful response",
              content: {
                "application/json": {
                  schema: response.schema || { type: "object" },
                },
              },
            },
            "400": {
              description: "Bad request - invalid parameters",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { error: { type: "string" } },
                  },
                },
              },
            },
            "404": {
              description: "Resource not found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { error: { type: "string" } },
                  },
                },
              },
            },
          };
          console.log(
            `[AI Enrich] Added responses for ${method.toUpperCase()} ${normalizedPath}`,
          );
        }
      }
    }

    cachedEnhancedSpec = { spec: baseSpec, timestamp: Date.now() };
    return baseSpec;
  } catch (err) {
    console.error("[AI Enrich Error]", err);
    return baseSpec;
  }
}

function formatSpecForAI(
  spec: Record<string, unknown>,
  locale?: string,
): string {
  const paths = spec.paths as Record<
    string,
    Record<
      string,
      {
        summary?: string;
        parameters?: unknown[];
        requestBody?: unknown;
        responses?: Record<
          string,
          {
            description?: string;
            content?: Record<string, { schema?: unknown }>;
          }
        >;
      }
    >
  >;
  const lines: string[] = ["API Endpoints:"];
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const params = op.parameters
        ?.map((p: unknown) => {
          const param = p as {
            name: string;
            in: string;
            required?: boolean;
            schema?: { type?: string; enum?: string[] };
          };
          const enumStr = param.schema?.enum
            ? ` enum=[${param.schema.enum.join(",")}]`
            : "";
          return `${param.name}(${param.in}:${param.schema?.type || "string"}${param.required ? ",required" : ""}${enumStr})`;
        })
        .join(" ");

      let responseInfo = "";
      if (op.responses?.["200"]?.content?.["application/json"]?.schema) {
        const schema = op.responses["200"].content["application/json"]
          .schema as Record<string, unknown>;
        const props = schema.properties as
          | Record<string, { type?: string; items?: unknown }>
          | undefined;
        if (props) {
          const fields = Object.entries(props)
            .map(([key, val]) => {
              if (val.type === "array" && val.items) {
                const itemProps = (
                  val.items as Record<string, { type?: string }>
                ).properties;
                const itemFields = itemProps
                  ? Object.keys(itemProps).join(",")
                  : "object";
                return `${key}:array[${itemFields}]`;
              }
              return `${key}:${val.type || "string"}`;
            })
            .join(", ");
          responseInfo = `  Response: { ${fields} }`;
        }
      }

      const lines2 = [
        `${method.toUpperCase()} ${path}`,
        `  Handler: ${op.summary || "unknown"}`,
        params ? `  Params: ${params}` : "",
        responseInfo,
      ].filter(Boolean);
      lines.push(lines2.join("\n"));
    }
  }
  return lines.join("\n");
}

interface EndpointResponse {
  description?: string;
  content?: Record<string, { schema?: unknown }>;
}

interface EndpointOperation {
  summary?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, EndpointResponse>;
}

function findEndpoint(
  spec: Record<string, unknown>,
  path: string,
  method: string,
): EndpointOperation | undefined {
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  const normalizedPath = path.replace(/\{(\w+)\}/g, ":$1");
  for (const [specPath, methods] of Object.entries(paths)) {
    const normalizedSpecPath = specPath.replace(/\{(\w+)\}/g, ":$1");
    if (normalizedSpecPath === normalizedPath) {
      return methods[method.toLowerCase()] as EndpointOperation | undefined;
    }
  }
  return undefined;
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

function checkAIConfig(): AIConfig {
  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL || "https://api.openai.com/v1/";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return { ok: false, error: "AI_API_KEY environment variable is not set" };
  }

  return { ok: true, apiKey, baseURL, model };
}

export function registerAIRoutes(router: Router): void {
  router.get(
    "/api/ai/test",
    handlerName("aiTest", async ({ res }) => {
      const config = checkAIConfig();
      if (!config.ok) {
        return res.json({ ok: false, error: config.error });
      }

      const requestPayload = {
        apiKey: config.apiKey
          ? `${config.apiKey.substring(0, 8)}...`
          : "missing",
        baseURL: config.baseURL,
        model: config.model,
        messages: [{ role: "user", content: "Say hello in one word." }],
        temperature: 0.1,
      };

      console.log("[AI Test] === REQUEST ===");
      console.log(JSON.stringify(requestPayload, null, 2));

      try {
        const result = await generateText({
          apiKey: config.apiKey,
          baseURL: config.baseURL!,
          model: config.model!,
          messages: [{ role: "user", content: "Say hello in one word." }],
          temperature: 0.1,
        });

        console.log("[AI Test] === RESPONSE ===");
        console.log(JSON.stringify(result, null, 2));

        res.json({
          ok: true,
          response: result.text,
          finishReason: result.finishReason,
          usage: result.usage,
          config: { baseURL: config.baseURL, model: config.model },
        });
      } catch (err) {
        console.error("[AI Test] === ERROR ===");
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        res.json({
          ok: false,
          error: message,
          stack,
          config: { baseURL: config.baseURL, model: config.model },
        });
      }
    }),
  );

  router.get(
    "/api/ai/config",
    handlerName("aiConfig", ({ res }) => {
      const config = checkAIConfig();
      if (!config.ok) {
        return res.json({
          configured: false,
          baseURL: null,
          model: null,
          apiKeyLength: 0,
          error: config.error,
        });
      }
      res.json({
        configured: true,
        baseURL: config.baseURL,
        model: config.model,
        apiKeyLength: config.apiKey.length,
        error: null,
      });
    }),
  );

  router.post(
    "/api/ai/ask",
    handlerName("aiAsk", async ({ req, res }) => {
      const body = req.parsedBody as
        | { question?: string; locale?: string }
        | undefined;
      if (!body?.question) {
        return res.status(400).json({ error: "question is required" });
      }

      const config = checkAIConfig();
      if (!config.ok) {
        return res.status(500).json({ error: config.error });
      }

      const locale =
        body.locale || req.headers?.get("accept-language")?.split(",")[0] || "en";
      const spec = await enrichOpenAPISpec(router);
      const specText = formatSpecForAI(spec, locale);

      const systemPrompt = `You are an API assistant for a web application. Help users understand the API.

Endpoints:
${specText}

Answer questions concisely. Reference endpoints by name.
Respond in the same language as the question or use locale: ${locale}.`;
      console.log(
        `[AI Ask] Sending to: ${config.baseURL}, model: ${config.model}`,
      );
      console.log(`[AI Ask] Question: ${body.question}`);

      try {
        const { text } = await generateText({
          apiKey: config.apiKey,
          baseURL: config.baseURL!,
          model: config.model!,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: body.question },
          ],
          temperature: 0.5,
        });

        console.log(`[AI Ask] Response: ${text?.substring(0, 100)}...`);
        res.json({ answer: text || "No response from AI" });
      } catch (err) {
        console.error("[AI Ask Error]", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ error: `AI request failed: ${message}` });
      }
    }),
  );

  router.post(
    "/api/ai/docs",
    handlerName("aiDocs", async ({ req, res }) => {
      const body = req.parsedBody as
        | { path?: string; method?: string; locale?: string }
        | undefined;
      if (!body?.path || !body?.method) {
        return res.status(400).json({ error: "path and method are required" });
      }

      const config = checkAIConfig();
      if (!config.ok) {
        return res.status(500).json({ error: config.error });
      }

      const locale =
        body.locale ||
        req.headers?.get("accept-language")?.split(",")[0] ||
        "en";
      const endpointContext = buildEndpointContext(
        router,
        body.path,
        body.method,
      );

      const spec = await enrichOpenAPISpec(router);
      const endpoint = findEndpoint(spec, body.path, body.method.toLowerCase());
      let responseInfo = "";
      if (endpoint?.responses?.["200"]?.content?.["application/json"]?.schema) {
        const schema = endpoint.responses["200"].content["application/json"]
          .schema as Record<string, unknown>;
        responseInfo = `\nResponse Schema:\n${JSON.stringify(schema, null, 2)}`;
      }

      const systemPrompt = `Write documentation for this API endpoint.

${endpointContext}${responseInfo}

Include in this EXACT order:
1. Title (H1): endpoint path
2. Description: what it does
3. Auth: required roles/permissions
4. Parameters table: name | type | required | description
5. Response example (JSON)
6. Error codes: status | cause

Keep it concise. Use markdown tables. Respond in locale: ${locale}.`;
      console.log(
        `[AI Docs] Sending to: ${config.baseURL}, model: ${config.model}`,
      );

      try {
        const { text } = await generateText({
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate docs for ${body.method.toUpperCase()} ${body.path}`,
            },
          ],
          temperature: 0.3,
        });

        console.log(`[AI Docs] Response: ${text?.substring(0, 100)}...`);
        res.json({
          documentation: text || "No documentation generated",
          format: "markdown",
          locale,
          path: body.path,
          method: body.method.toUpperCase(),
        });
      } catch (err) {
        console.error("[AI Docs Error]", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        res
          .status(500)
          .json({ error: `Documentation generation failed: ${message}` });
      }
    }),
  );

  router.post(
    "/api/ai/curl",
    handlerName("aiCurl", async ({ req, res }) => {
      const body = req.parsedBody as
        | {
            path?: string;
            method?: string;
            params?: Record<string, string>;
            locale?: string;
          }
        | undefined;
      if (!body?.path || !body?.method) {
        return res.status(400).json({ error: "path and method are required" });
      }

      const config = checkAIConfig();
      if (!config.ok) {
        return res.status(500).json({ error: config.error });
      }

      const locale =
        body.locale || req.headers?.get("accept-language")?.split(",")[0] || "en";
      const endpointContext = buildEndpointContext(
        router,
        body.path,
        body.method,
      );
      const paramsJson = body.params
        ? JSON.stringify(body.params, null, 2)
        : "None";

      const systemPrompt = `Generate a curl command for this API endpoint.

${endpointContext}

Parameter values: ${paramsJson}

Use base URL http://localhost:3000. Return only the curl command.
Respond in locale: ${locale}.`;
      console.log(
        `[AI Curl] Sending to: ${config.baseURL}, model: ${config.model}`,
      );

      try {
        const { text } = await generateText({
          apiKey: config.apiKey,
          baseURL: config.baseURL!,
          model: config.model!,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate curl for ${body.method.toUpperCase()} ${body.path}`,
            },
          ],
          temperature: 0.2,
        });

        console.log(`[AI Curl] Response: ${text?.substring(0, 100)}...`);
        res.json({ curl: text || "curl -X GET http://localhost:3000/health" });
      } catch (err) {
        console.error("[AI Curl Error]", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ error: `Curl generation failed: ${message}` });
      }
    }),
  );
}
