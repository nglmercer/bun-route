import { Router, handlerName } from "../../../src/index"
import { users } from "./types"

export function createAdminRouter(): Router {
  const admin = new Router()

  admin.get("/users", handlerName("adminListUsers", ({ res }) => {
    res.json({ admin: true, users })
  }))

  admin.get("/stats", handlerName("adminStats", ({ res }) => {
    res.json({ totalUsers: users.length, uptime: process.uptime() })
  }))

  return admin
}
