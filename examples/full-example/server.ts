import { Router } from "../../src/index";
import { setupMiddleware } from "./lib/middleware";
import { registerUserRoutes } from "./lib/users";
import { registerSearchRoutes } from "./lib/search";
import { registerResponseRoutes } from "./lib/response";
import { registerContextRoutes } from "./lib/context";
import { registerUploadRoutes } from "./lib/upload";
import { registerEventRoutes } from "./lib/events";
import { registerWebSocket } from "./lib/websocket";
import { registerInfoRoutes } from "./lib/info";
import { registerV1Routes } from "./lib/v1";
import { registerSlowRoutes } from "./lib/slow";
import { createAdminRouter } from "./lib/admin";
import { registerAIRoutes } from "./lib/ai";

const router = new Router();

// Global middleware stack
setupMiddleware(router);

// Feature modules
registerUserRoutes(router);
registerSearchRoutes(router);
registerResponseRoutes(router);
registerContextRoutes(router);
registerUploadRoutes(router);
registerEventRoutes(router);
registerWebSocket(router);
registerInfoRoutes(router);
registerV1Routes(router);
registerSlowRoutes(router);
registerAIRoutes(router);

// Sub-router mounting
router.mount("/api/admin", createAdminRouter());

router.serveStatic({
  root: import.meta.dir + "/public",
  index: "index.html",
});

router.serveStatic({
  root: import.meta.dir + "/public/src",
  mount: "/src",
  dev: true,
});

router.get("/theme.css", ({ res }) => {
  return res.file(Bun.file(import.meta.dir + "/public/src/styles/theme.css"));
});
// Start server
export const server = Bun.serve({
  fetch: router.handle,
  port: 3000,
  websocket: router.getWebSocketHandlers()!,
});

console.info(router.dump(server));
