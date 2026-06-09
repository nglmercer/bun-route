import { handlerName } from "../../../src/index"
import type { Router } from "../../../src/index"

export function registerSlowRoutes(router: Router): void {
  router.get("/api/slow/computation", handlerName("slowComputation", async ({ res }) => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    res.json({ result: "completed within timeout" })
  }))
}
