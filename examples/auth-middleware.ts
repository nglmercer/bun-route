/**
 * Example: Auth Middleware with bun-route
 * 
 * Shows how to implement authentication and role-based authorization
 * as a user of the bun-route library.
 * 
 * Run: bun run examples/auth-middleware.ts
 */

import { Router } from "../src/router"
import type { RequestMiddleware, Request } from "../src/types"
import { HTTP_STATUS } from "../src/responseBuilder"

// --- 1. Extend Request type with module augmentation ---
declare module "../src/types" {
  interface Request {
    user?: {
      id: string
      role: "admin" | "user" | "moderator"
      email: string
      username: string
    }
  }
}

// --- 2. Auth middleware factory ---
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

  return async ({ req, res }) => {
    const authHeader = req.headers.get(headerName)
    if (!authHeader) {
      if (optional) return
      res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Missing authorization header" })
      return
    }

    let token = authHeader
    if (tokenPrefix && authHeader.startsWith(tokenPrefix)) {
      token = authHeader.slice(tokenPrefix.length)
    }

    if (!token) {
      if (optional) return
      res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Missing token" })
      return
    }

    const user = await options.verifyToken(token)
    if (!user) {
      if (optional) return
      res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Invalid token" })
      return
    }

    req.user = user as Request["user"]
  }
}

// --- 3. Role authorization middleware ---
function requireRole(...roles: string[]): RequestMiddleware {
  return ({ req, res }) => {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: "Authentication required" })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({ error: "Insufficient permissions", required: roles })
      return
    }
  }
}

// --- 4. Token verification (replace with real JWT/DB logic) ---
async function verifyToken(token: string) {
  if (token === "valid-admin-token") {
    return { id: "1", role: "admin" as const, email: "admin@example.com", username: "admin" }
  }
  if (token === "valid-user-token") {
    return { id: "2", role: "user" as const, email: "user@example.com", username: "john" }
  }
  return null
}

// --- 5. Create middleware instances ---
const auth = createAuth({ verifyToken, tokenPrefix: "Bearer " })
const optionalAuth = createAuth({ verifyToken, tokenPrefix: "Bearer ", optional: true })

// --- 6. Setup routes ---
const app = new Router()

// Public
app.get("/public", ({ req, res }) => res.json({ message: "Public" }))

// Optional auth
app.get("/feed", optionalAuth, ({ req, res }) => {
  if (req.user) {
    res.json({ message: `Personalized feed for ${req.user.username}` })
  } else {
    res.json({ message: "Public feed" })
  }
})

// Protected
app.get("/profile", auth, ({ req, res }) => {
  res.json({ id: req.user!.id, username: req.user!.username, email: req.user!.email })
})

// Role-based
app.get("/admin/users", auth, requireRole("admin"), ({ req, res }) => {
  res.json({ message: "Admin panel" })
})

app.get("/dashboard", auth, requireRole("admin", "moderator"), ({ req, res }) => {
  res.json({ message: "Dashboard" })
})

// Global auth for /api/*
app.use("*", "/api/*", auth)
app.get("/api/posts", ({ req, res }) => res.json({ message: `Posts for ${req.user!.id}` }))

// --- 7. Start server ---
const server = Bun.serve({
  port: 3000,
  fetch: app.handle,
})
console.log(`Server running at http://localhost:${server.port}`)
