import { handlerName } from "../../../src/index"
import type { Router } from "../../../src/index"
import { users } from "./types"

export function registerInfoRoutes(router: Router): void {
  router.get("/api/info", handlerName("getInfo", ({ res }) => {
    const routes = router.getRoutes()
    res.json({
      name: "router-bun full example",
      version: "1.0.0",
      endpoints: routes,
      websocket: "WS /ws",
    })
  }))

  router.get("/api/docs", handlerName("getDocs", ({ res }) => {
    const defs = router.getRouteDefinitions()
    res.json(defs)
  }))

  router.get("/api/openapi", handlerName("getOpenApi", ({ res }) => {
    const defs = router.getRouteDefinitions()
    const paths: Record<string, Record<string, unknown>> = {}
    for (const def of defs) {
      const swaggerPath = def.path.replace(/:(\w+)/g, "{$1}")
      if (!paths[swaggerPath]) paths[swaggerPath] = {}
      paths[swaggerPath][def.method.toLowerCase()] = {
        summary: def.handlerName,
        parameters: [
          ...def.pathParams.map(p => ({
            name: p.name,
            in: "path" as const,
            required: true,
            schema: { type: "string" },
          })),
          ...(def.queryParams || []).map(p => ({
            name: p.name,
            in: "query" as const,
            required: p.required,
            description: p.description,
            schema: { type: p.type, default: p.default, enum: p.enum },
          })),
        ],
      }
    }
    res.json({ openapi: "3.0.0", info: { title: "router-bun API", version: "1.0.0" }, paths })
  }))

  router.get("/api/routes", handlerName("listRoutes", ({ res }) => {
    const defs = router.getRouteDefinitions()
    res.json(defs.map(d => ({
      method: d.method,
      path: d.path,
      handler: d.handlerName,
      middleware: d.middlewareChain.map(m => m.name),
      pathParams: d.pathParams,
      queryParams: d.queryParams,
    })))
  }))

  router.get("/api/request-info", handlerName("getRequestInfo", ({ req, res }) => {
    res.json({
      ip: req.ip,
      ips: req.ips,
      method: req.method,
      path: req.path,
      userAgent: req.headers.get("user-agent"),
      requestId: req.id,
      cookies: req.cookies,
    })
  }))

  router.options("/api/**", ({ res }) => {
    res.status(204).send()
  })

  router.head("/api/health", ({ res }) => {
    res.status(200).send()
  })
}
