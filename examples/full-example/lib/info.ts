import { handlerName } from "../../../src/index";
import type { Router, RouteDefinition } from "../../../src/index";

function toOpenApiSpec(defs: RouteDefinition[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const def of defs) {
    if (!def.method || def.method === "ALL" || def.middlewareName) continue;
    const method = def.method.toLowerCase();
    if (!paths[def.path]) paths[def.path] = {};
    const params: Record<string, unknown>[] = [];
    for (const p of def.pathParams) {
      params.push({
        name: p.name,
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }
    for (const q of def.queryParams || []) {
      params.push({
        name: q.name,
        in: "query",
        required: q.required ?? false,
        description: q.description,
        schema: {
          type: q.type || "string",
          ...(q.default !== undefined ? { default: q.default } : {}),
          ...(q.enum ? { enum: q.enum } : {}),
        },
      });
    }
    paths[def.path][method] = {
      summary: `${def.method} ${def.path}`,
      description: `Handler: ${def.handlerName}`,
      parameters: params.length > 0 ? params : undefined,
      responses: {
        "200": { description: "Successful response" },
        "400": { description: "Bad request" },
        "500": { description: "Internal server error" },
      },
    };
  }
  return {
    openapi: "3.0.3",
    info: { title: "router-bun full example", version: "1.0.0" },
    paths,
  };
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
      const defs = router.getRouteDefinitions();
      res.json(toOpenApiSpec(defs));
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
