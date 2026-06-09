import { Router, handlerName } from "../../../src/index"
import { users } from "./types"

export function registerUserRoutes(router: Router): void {
  router.get("/api/users", handlerName("listUsers", ({ req, res }) => {
    const page = req.queryParam("page").int(1)!
    const limit = req.queryParam("limit").int(10)!
    const role = req.queryParam("role").enum(["admin", "user"])
    let filtered = users
    if (role) filtered = filtered.filter(u => u.role === role)
    res.json({ page, limit, total: filtered.length, data: filtered })
  }))

  router.describe("/api/users", {
    queryParams: [
      { name: "page", type: "integer", required: false, default: 1, description: "Page number" },
      { name: "limit", type: "integer", required: false, default: 10, description: "Items per page" },
      { name: "role", type: "string", required: false, enum: ["admin", "user"], description: "Filter by role" },
    ],
  })

  router.get("/api/users/:id", handlerName("getUser", ({ req, res }) => {
    const id = req.pathParam("id").require("id")
    const user = users.find(u => u.id === id)
    if (!user) return res.status(404).json({ error: "User not found" })
    res.json(user)
  }))

  router.post("/api/users", handlerName("createUser", ({ req, res }) => {
    const body = req.parsedBody as { name?: string; role?: string } | undefined
    if (!body?.name) return res.status(400).json({ error: "name is required" })
    const user = { id: String(users.length + 1), name: body.name, role: (body.role || "user") as "admin" | "user" }
    users.push(user)
    res.status(201).json(user)
  }))

  router.put("/api/users/:id", handlerName("updateUser", ({ req, res }) => {
    const id = req.pathParam("id").require("id")
    const user = users.find(u => u.id === id)
    if (!user) return res.status(404).json({ error: "User not found" })
    const body = req.parsedBody as { name?: string; role?: string } | undefined
    if (body?.name) user.name = body.name
    if (body?.role) user.role = body.role as "admin" | "user"
    res.json(user)
  }))

  router.delete("/api/users/:id", handlerName("deleteUser", ({ req, res }) => {
    const id = req.pathParam("id").require("id")
    const idx = users.findIndex(u => u.id === id)
    if (idx === -1) return res.status(404).json({ error: "User not found" })
    users.splice(idx, 1)
    res.status(204).send()
  }))

  router.patch("/api/users/:id/role", handlerName("changeUserRole", ({ req, res }) => {
    const id = req.pathParam("id").require("id")
    const user = users.find(u => u.id === id)
    if (!user) return res.status(404).json({ error: "User not found" })
    const body = req.parsedBody as { role?: string } | undefined
    if (!body?.role) return res.status(400).json({ error: "role is required" })
    user.role = body.role as "admin" | "user"
    res.json(user)
  }))
}
