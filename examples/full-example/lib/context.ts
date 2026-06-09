import { handlerName } from "../../../src/index"
import type { Router } from "../../../src/index"

export function registerContextRoutes(router: Router): void {
  router.get("/api/context-demo", handlerName("contextDemo", ({ set, get, res }) => {
    set("user", { id: "1", name: "Alice", role: "admin" })
    const user = get("user")
    res.json({ stored: user })
  }))
}
