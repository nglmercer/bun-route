import { handlerName } from "../../../src/index"
import type { Router } from "../../../src/index"

export function registerV1Routes(router: Router): void {
  router.group("/api/v1", (r) => {
    r.get("/status", handlerName("getStatus", ({ res }) => {
      res.json({ status: "ok", version: "v1" })
    }))

    r.get("/health", handlerName("getHealth", ({ res }) => {
      res.json({ uptime: process.uptime() })
    }))
  })
}
