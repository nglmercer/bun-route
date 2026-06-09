import { handlerName } from "../../../src/index";
import type { Router } from "../../../src/index";

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
      const spec = router.getRouteDefinitions();
      res.json(spec);
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
