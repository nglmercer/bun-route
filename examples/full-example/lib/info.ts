import { handlerName } from "../../../src/index";
import type { Router, RouteDefinition } from "../../../src/index";
import { checkAIConfig, callAI } from "./ai-shared";

let cachedOpenApiSpec: unknown | null = null;

function buildFallbackSpec(defs: RouteDefinition[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const def of defs) {
    if (!def.method || def.method === "ALL" || def.middlewareName) continue;
    const method = def.method.toLowerCase();
    if (!paths[def.path]) paths[def.path] = {};
    const params: Record<string, unknown>[] = [];
    for (const p of def.pathParams) {
      params.push({ name: p.name, in: "path", required: true, schema: { type: "string" } });
    }
    for (const q of def.queryParams || []) {
      params.push({
        name: q.name, in: "query",
        required: q.required ?? false,
        ...(q.description ? { description: q.description } : {}),
        schema: {
          type: q.type || "string",
          ...(q.default !== undefined ? { default: q.default } : {}),
          ...(q.enum ? { enum: q.enum } : {}),
        },
      });
    }
    paths[def.path][method] = {
      parameters: params.length > 0 ? params : undefined,
    };
  }
  return { openapi: "3.0.3", info: { title: "router-bun full example", version: "1.0.0" }, paths };
}

async function generateOpenApiSpecWithAI(defs: RouteDefinition[]): Promise<unknown | null> {
  const config = checkAIConfig();
  if (!config.ok) return null;

  const endpointsJson = JSON.stringify(
    defs
      .filter((d) => d.method && d.method !== "ALL" && !d.middlewareName)
      .map((d) => ({
        method: d.method,
        path: d.path,
        pathParams: d.pathParams,
        queryParams: d.queryParams,
      })),
    null,
    2,
  );

  const result = await callAI(
    config,
    [
      {
        role: "system",
        content: `Generate a complete OpenAPI 3.0.3 spec from the endpoint list below.
Return ONLY valid JSON. Add realistic summaries, descriptions, response schemas with examples.
Enrich parameters with descriptions where possible.

The output paths object must cover every endpoint. Each endpoint path+method must appear.
Use this structure:
{
  "openapi": "3.0.3",
  "info": { "title": "router-bun API", "version": "1.0.0" },
  "paths": {
    "/path": {
      "get": {
        "summary": "...",
        "description": "...",
        "parameters": [...],
        "responses": {
          "200": { "description": "...", "content": { "application/json": { "schema": { ... } } } },
          "400": { "description": "Bad request" },
          "500": { "description": "Internal server error" }
        }
      }
    }
  }
}`,
      },
      {
        role: "user",
        content: `Generate an OpenAPI spec for these endpoints:\n${endpointsJson}`,
      },
    ],
    0.2,
  );

  if (!result.ok) return null;
  try {
    return JSON.parse(result.text);
  } catch {
    return null;
  }
}

export async function cacheOpenApiSpec(router: Router): Promise<void> {
  const defs = router.getRouteDefinitions();
  const aiSpec = await generateOpenApiSpecWithAI(defs);
  cachedOpenApiSpec = aiSpec ?? buildFallbackSpec(defs);
}

export function registerInfoRoutes(router: Router): void {
  router.get(
    "/api/info",
    handlerName("getInfo", ({ res }) => {
      const routes = router.getRoutes();
      res.json({
        name: "router-bun full example",
        version: "1.0.0",
        endpoints: routes,
        websocket: "WS /ws",
      });
    }),
  );

  router.get(
    "/api/docs",
    handlerName("getDocs", ({ res }) => {
      const defs = router.getRouteDefinitions();
      res.json(defs);
    }),
  );

  router.get(
    "/api/openapi",
    handlerName("getOpenApi", async ({ res }) => {
      if (cachedOpenApiSpec) return res.json(cachedOpenApiSpec);
      const defs = router.getRouteDefinitions();
      const aiSpec = await generateOpenApiSpecWithAI(defs);
      cachedOpenApiSpec = aiSpec ?? buildFallbackSpec(defs);
      res.json(cachedOpenApiSpec);
    }),
  );

  router.get(
    "/api/routes",
    handlerName("listRoutes", ({ res }) => {
      const defs = router.getRouteDefinitions();
      res.json(
        defs.map((d) => ({
          method: d.method,
          path: d.path,
          handler: d.handlerName,
          middleware: d.middlewareChain.map((m) => m.name),
          pathParams: d.pathParams,
          queryParams: d.queryParams,
        })),
      );
    }),
  );

  router.get(
    "/api/request-info",
    handlerName("getRequestInfo", ({ req, res }) => {
      res.json({
        ip: req.ip,
        ips: req.ips,
        method: req.method,
        path: req.path,
        userAgent: req.headers.get("user-agent"),
        requestId: req.id,
        cookies: req.cookies,
      });
    }),
  );

  router.options("/api/**", ({ res }) => {
    res.status(204).send();
  });

  router.head("/api/health", ({ res }) => {
    res.status(200).send();
  });
}
