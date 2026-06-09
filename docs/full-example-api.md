# Full Example API - router-bun

A complete, modular API demonstrating **every feature** of router-bun.

## Run

```sh
cd examples/full-example
bun run server.ts
```

Open http://localhost:3000 for an HTML index of all endpoints.

---

## Architecture

```
examples/full-example/
  server.ts              ← Entry point, wires modules together
  lib/
    types.ts             ← Shared types and data
    middleware.ts         ← Global middleware stack
    users.ts             ← User CRUD routes
    search.ts            ← Search & path param demos
    response.ts          ← Response builder demos
    context.ts           ← Context data store demo
    upload.ts            ← File upload routes
    events.ts            ← Server-Sent Events
    websocket.ts         ← WebSocket handlers
    info.ts              ← API info, docs, openapi, routes listing
    v1.ts                ← API v1 group routes
    admin.ts             ← Admin sub-router
    slow.ts              ← Timeout demo routes
  public/
    index.html           ← Static file serving demo
```

## Module Breakdown

### `server.ts` — Entry Point

Creates the router, applies middleware, registers all modules, mounts sub-routers, and starts the server.

```ts
const router = new Router()
setupMiddleware(router)
registerUserRoutes(router)
// ... other modules
router.mount("/api/admin", createAdminRouter())
Bun.serve({ fetch: router.handle, websocket: router.getWebSocketHandlers()! })
```

### `lib/middleware.ts` — Global Middleware

Sets up error handling, request ID, CORS, cookies, logging, body parser, rate limiting, timeout, static files, and redirects.

```ts
export function setupMiddleware(router: Router): void {
  router.onError(/* ... */)
  router.requestId("*", "/**")
  router.cors("*", "/**", { origin: "*" })
  router.cookies("*", "/**", true)
  router.use("*", "/**", /* logging */)
  router.body("*", "/api/**", { json: true })
  router.rateLimit("POST", "/api/**", { max: 30, windowMs: 60_000 })
  router.timeout("*", "/api/slow/**", { timeoutMs: 3000 })
  router.static("/static/**", "./public")
  router.redirect("*", "/old", "/api/info")
}
```

### `lib/types.ts` — Shared Types & Data

Declares `ContextDataMap` for type-safe context, exports the `User` interface and in-memory data.

```ts
declare module "router-bun" {
  interface ContextDataMap {
    user: { id: string; name: string; role: "admin" | "user" }
  }
}
export const users: User[] = [{ id: "1", name: "Alice", role: "admin" }]
```

### `lib/users.ts` — User CRUD

Full CRUD with named params, query params, `handlerName()`, and `router.describe()` for OpenAPI metadata.

| Route | Description |
|-------|-------------|
| `GET /api/users` | List users (paginated, filterable by role) |
| `GET /api/users/:id` | Get user by ID |
| `POST /api/users` | Create user |
| `PUT /api/users/:id` | Update user |
| `PATCH /api/users/:id/role` | Change user role |
| `DELETE /api/users/:id` | Delete user |

### `lib/search.ts` — Search & Wildcards

Demonstrates single `*` and double `**` wildcards, query param helpers (`string`, `int`, `enum`, `boolean`, `numberBetween`).

| Route | Description |
|-------|-------------|
| `GET /api/search` | Search with validated query params |
| `GET /api/files/*` | Single wildcard match |
| `GET /api/assets/**` | Double wildcard match |

### `lib/response.ts` — Response Builder

Every response method: `json`, `text`, `html`, `sendRedirect`, `sendNoContent`, `sendError`, `setCookie`, `setHeader`, `cache`.

| Route | Description |
|-------|-------------|
| `GET /api/response/json` | JSON response with status |
| `GET /api/response/text` | Plain text response |
| `GET /api/response/html` | HTML response |
| `GET /api/response/cookie` | Set cookies |
| `GET /api/response/headers` | Custom headers |
| `GET /api/response/redirect` | Redirect |
| `GET /api/response/no-content` | 204 No Content |
| `GET /api/response/error` | Error response |
| `GET /api/response/cache` | Cache-Control header |

### `lib/context.ts` — Context Data Store

Type-safe `set()` / `get()` for per-request data passing.

### `lib/upload.ts` — File Upload

Multipart parsing with `fileUpload` middleware, `Router.getFile()`, `Router.getFiles()`, `Router.getFormFields()`.

| Route | Description |
|-------|-------------|
| `POST /api/upload` | Single file upload |
| `POST /api/upload/multi` | Multi-file upload |

### `lib/events.ts` — Server-Sent Events

`createSSEStream()` with `sendEvent()`, `sendComment()`, `close()`, and broadcast endpoint.

| Route | Description |
|-------|-------------|
| `GET /api/events` | SSE stream |
| `POST /api/events/broadcast` | Broadcast to all SSE clients |

### `lib/websocket.ts` — WebSocket

`router.ws()` with `open`, `message`, `close` handlers.

| Route | Description |
|-------|-------------|
| `WS /ws` | Echo WebSocket |

### `lib/info.ts` — API Info & Docs

Route listing, OpenAPI generation, request info, OPTIONS preflight, HEAD health check.

| Route | Description |
|-------|-------------|
| `GET /api/info` | API info |
| `GET /api/docs` | Route definitions |
| `GET /api/openapi` | OpenAPI 3.0 spec |
| `GET /api/routes` | All routes with middleware |
| `GET /api/request-info` | Request metadata |
| `OPTIONS /api/**` | CORS preflight |
| `HEAD /api/health` | Health check |

### `lib/v1.ts` — Route Groups

Demonstrates `router.group()` for prefix-based grouping.

| Route | Description |
|-------|-------------|
| `GET /api/v1/status` | Status |
| `GET /api/v1/health` | Health |

### `lib/admin.ts` — Sub-Router Mounting

Demonstrates `router.mount()` with a separate `Router` instance.

| Route | Description |
|-------|-------------|
| `GET /api/admin/users` | Admin user list |
| `GET /api/admin/stats` | Admin stats |

### `lib/slow.ts` — Timeout Demo

Handler that takes 2s, demonstrating the 3s timeout middleware.

| Route | Description |
|-------|-------------|
| `GET /api/slow/computation` | Slow handler |

---

## Features Quick Reference

| Feature | Where | API |
|---------|-------|-----|
| Error handling | `middleware.ts` | `router.onError()` |
| Request ID | `middleware.ts` | `router.requestId()` |
| CORS | `middleware.ts` | `router.cors()` |
| Cookies | `middleware.ts` | `router.cookies()` |
| Body parser | `middleware.ts` | `router.body()` |
| Rate limit | `middleware.ts` | `router.rateLimit()` |
| Timeout | `middleware.ts` | `router.timeout()` |
| Static files | `middleware.ts` | `router.static()` |
| Redirects | `middleware.ts` | `router.redirect()` |
| Named params | `users.ts` | `/:id` in path |
| Wildcards | `search.ts` | `/*` and `/**` |
| Query params | `search.ts` | `req.queryParam()` |
| Handler naming | `users.ts` | `handlerName()` |
| Route metadata | `users.ts` | `router.describe()` |
| Route groups | `v1.ts` | `router.group()` |
| Sub-router mount | `admin.ts` | `router.mount()` |
| SSE | `events.ts` | `createSSEStream()` |
| WebSocket | `websocket.ts` | `router.ws()` |
| File upload | `upload.ts` | `router.fileUpload()` |
| Context store | `context.ts` | `ctx.set()` / `ctx.get()` |
| Response builder | `response.ts` | `res.json()` etc. |
| Route dump | `info.ts` | `router.dump()` |
| Route definitions | `info.ts` | `router.getRouteDefinitions()` |
| OpenAPI generation | `info.ts` | `getRouteDefinitions()` + transform |

---

## Middleware Order

Applied in this order (recommended):

1. **Error handler** — catches unhandled errors
2. **Request ID** — assigns trace ID
3. **CORS** — handles preflight and headers
4. **Cookies** — parses cookies
5. **Logging** — request/response timing
6. **Body parser** — JSON/form bodies
7. **Rate limit** — throttles POST requests
8. **Timeout** — aborts slow requests

## Tips

- Use `handlerName()` for meaningful names in `dump()` and `getRouteDefinitions()`
- Use `router.describe()` to add query param metadata for OpenAPI generation
- Use `router.group()` and `router.mount()` for modular route organization
- Use `ctx.set()` / `ctx.get()` for type-safe per-request data passing
- Use `createTestContext()` for unit testing handlers without an HTTP server
- Use `res.beforeSent()` hooks for logging, cleanup, or header modifications
