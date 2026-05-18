/**
 * Example: Auth Middleware with bun-route
 *
 * Shows how to implement authentication and role-based authorization
 * using ContextDataMap augmentation — ctx.get("user") infers UserData
 * automatically, no generics needed at the call site.
 *
 * Run: bun run examples/auth-middleware.ts
 */

import { Router } from "../src/router"
import type { RequestMiddleware } from "../src/types"
import { HTTP_STATUS } from "../src/responseBuilder"

// --- 1. Declare the data shape via module augmentation ---

interface UserData {
  id: string
  role: "admin" | "user" | "moderator"
  email: string
  username: string
}

declare module "../src/types" {
  interface ContextDataMap {
    user: UserData
  }
}

// --- 2. Auth middleware factory (generic, reusable) ---

interface AuthOptions<T> {
  verifyToken: (token: string) => T | null | Promise<T | null>
  headerName?: string
  tokenPrefix?: string
  optional?: boolean
}

function createAuth<T>(options: AuthOptions<T>): RequestMiddleware {
  const headerName = options.headerName ?? "Authorization"
  const tokenPrefix = options.tokenPrefix ?? "Bearer "
  const optional = options.optional ?? false

  return async (ctx) => {
    const authHeader = ctx.req.headers.get(headerName)
    if (!authHeader) {
      if (optional) return
      ctx.res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Missing authorization header" })
      return
    }

    let token = authHeader
    if (tokenPrefix && authHeader.startsWith(tokenPrefix)) {
      token = authHeader.slice(tokenPrefix.length)
    }

    if (!token) {
      if (optional) return
      ctx.res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Missing token" })
      return
    }

    const user = await options.verifyToken(token)
    if (!user) {
      if (optional) return
      ctx.res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Invalid token" })
      return
    }

    ctx.set("user", user)
  }
}

// --- 3. Role authorization middleware (auto-inferred) ---

function requireRole(...roles: UserData["role"][]): RequestMiddleware {
  return (ctx) => {
    const user = ctx.get("user")  // auto-inferred as UserData | undefined
    if (!user) {
      ctx.res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Authentication required" })
      return
    }
    if (!roles.includes(user.role)) {
      ctx.res.status(HTTP_STATUS.FORBIDDEN).json({ error: "Insufficient permissions", required: roles })
      return
    }
  }
}

// --- 4. Token verification ---

async function verifyToken(token: string): Promise<UserData | null> {
  if (token === "valid-admin-token") {
    return { id: "1", role: "admin", email: "admin@example.com", username: "admin" }
  }
  if (token === "valid-user-token") {
    return { id: "2", role: "user", email: "user@example.com", username: "john" }
  }
  return null
}

// --- 5. Create middleware instances ---

const auth = createAuth<UserData>({ verifyToken })
const optionalAuth = createAuth<UserData>({ verifyToken, optional: true })

// --- 6. Setup routes ---

const app = new Router()

// Public
app.get("/public", (ctx) => ctx.res.json({ message: "Public" }))

// Optional auth — ctx.get("user") auto-infers UserData
app.get("/feed", optionalAuth, (ctx) => {
  const user = ctx.get("user")
  if (user) {
    ctx.res.json({ message: `Personalized feed for ${user.username}` })
  } else {
    ctx.res.json({ message: "Public feed" })
  }
})

// Protected — no non-null assertions needed
app.get("/profile", auth, (ctx) => {
  const user = ctx.get("user")
  ctx.res.json({ id: user!.id, username: user!.username, email: user!.email })
})

// Role-based
app.get("/admin/users", auth, requireRole("admin"), (ctx) => {
  ctx.res.json({ message: "Admin panel" })
})

app.get("/dashboard", auth, requireRole("admin", "moderator"), (ctx) => {
  ctx.res.json({ message: "Dashboard" })
})

// Global auth for /api/*
app.use("*", "/api/*", auth)
app.get("/api/posts", (ctx) => {
  const user = ctx.get("user")
  ctx.res.json({ message: `Posts for ${user!.id}` })
})

// --- 7. Start server ---

const server = Bun.serve({
  port: 3000,
  fetch: app.handle,
})
console.log(`Server running at http://localhost:${server.port}`)
