# bun-route

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![npm](https://img.shields.io/npm/v/bun-route.svg?style=plastic&logo=npm&color=red)

**A fast, Express-like router for `bun.serve()`.**

`bun-route` leverages Bun's `bun.serve()` to deliver a fast, familiar routing experience. It provides an Express-like API with built-in middleware for CORS, rate limiting, file uploads, and SSE. Includes a Socket.IO example for real-time applications.

---

- [Install](#install)
- [Quick Start](#quick-start)
- [Router API](#router-api)
- [Routing](#routing)
- [Middleware](#middleware)
- [Request & Response](#request--response)
- [Route Dump & Stats](#route-dump--stats)
- [Examples](#examples)
- [TypeScript](#typescript)
- [Tests](#tests)
- [License](#license)

---

## Install

```sh
npm i bun-route
```

---

## Quick Start

```ts
import { Router } from "bun-route";

const router = new Router();

router.get("/", ({ res }) => {
  res.send("Hello from bun-route!");
});

Bun.serve({ fetch: router.handle });
```

### With WebSocket support

```ts
import { Router } from "bun-route";

const router = new Router();

router.get("/", ({ res }) => res.send("Hello!"));
router.ws("/ws");

Bun.serve({
  fetch: router.handle,
  websocket: {
    open(ws) { console.log("WS open"); },
    message(ws, msg) { ws.send(msg); },
    close(ws) { console.log("WS closed"); },
  },
});
```

---

## Router API

### Creating a Router

```ts
const router = new Router();
```

### Route Methods

All methods return the `Router` instance for chaining.

| Method | Signature |
|--------|-----------|
| `get` | `(path, handler, ...handlers)` |
| `post` | `(path, handler, ...handlers)` |
| `put` | `(path, handler, ...handlers)` |
| `delete` | `(path, handler, ...handlers)` |
| `patch` | `(path, handler, ...handlers)` |
| `options` | `(path, handler, ...handlers)` |
| `head` | `(path, handler, ...handlers)` |
| `trace` | `(path, handler, ...handlers)` |
| `connect` | `(path, handler, ...handlers)` |
| `use` | `(method, path, handler, ...handlers)` — catch-all method |

### Route Groups

```ts
router.group("/api", (r) => {
  r.get("/users", handler);
  r.post("/users", handler);
});
// Registers: GET /api/users, POST /api/users
```

### Sub-router Mounting

```ts
const sub = new Router();
sub.get("/items", handler);

router.mount("/api/v1", sub);
// Registers: GET /api/v1/items
```

### Error Handling

```ts
router.onError((err, { req, res }) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

### WebSocket

```ts
router.ws("/ws");
router.setWebSocketHandlers({
  open(ws) {},
  message(ws, msg) {},
  close(ws) {},
});
```

### Request Testing

```ts
const res = await router.request("/api/users", { method: "GET" });
```

### Static Helpers

```ts
Router.parseCookies(req);
Router.storeCookies(req, res);
Router.getFile(req, "avatar");
Router.getFiles(req, "photos");
Router.getFileFieldNames(req);
Router.getFormFields(req);
```

---

## Routing

### Path Patterns

| Pattern | Description | Example Match |
|---------|-------------|---------------|
| `/users/:id` | Named parameter | `/users/42` |
| `/files/*` | Single wildcard (matches one segment) | `/files/doc` |
| `/files/**` | Double wildcard (matches zero or more) | `/files/a/b/c` |
| `/static/**` | Serve all nested paths | `/static/css/main.css` |

### Named Parameters

```ts
router.get("/users/:id/posts/:postId", ({ req, res }) => {
  const id = req.pathParam("id").int();      // number | undefined
  const postId = req.pathParam("postId").require();  // string (throws if missing)
  res.json({ id, postId });
});
```

### Query Parameters

```ts
router.get("/search", ({ req, res }) => {
  const q = req.queryParam("q").string();
  const page = req.queryParam("page").int() ?? 1;
  const sort = req.queryParam("sort").enum(["asc", "desc"]) ?? "asc";
  res.json({ q, page, sort });
});
```

### Type helper: `Param`

Both `req.queryParam()` (query) and `req.pathParam()` (path) return a `Param` instance with typed accessor methods:

| Method | Returns | Description |
|--------|---------|-------------|
| `.string()` | `string \| undefined` | Value as string |
| `.int()` | `number \| undefined` | Integer value |
| `.number()` | `number \| undefined` | Numeric value |
| `.numberBetween(min, max)` | `number \| undefined` | Clamped number |
| `.boolean()` | `boolean \| undefined` | `"true"`/`"1"` → `true`, `"false"`/`"0"` → `false` |
| `.enum(allowed)` | `T \| undefined` | Only returns if value matches allowed set |
| `.require(name?)` | `string` | Returns value or throws |
| `.exists()` | `boolean` | Whether the param is present |
| `.or(default)` | `string` | Value or fallback default |
| `.array()` | `string[]` | All values as array |
| `.rawValue()` | `string \| string[] \| undefined` | Unprocessed raw value |

---

## Middleware

### Built-in Middleware

All built-in middleware can be applied as direct router methods:

```ts
router.cors("*", "/**", { origin: "*" });
router.body("*", "/api/*", { json: true, form: true });
router.rateLimit("POST", "/api/*", { max: 10, windowMs: 60000 });
router.requestId("*", "/**", { header: "X-Trace-Id" });
router.timeout("POST", "/api/upload", { timeoutMs: 5000 });
router.fileUpload("POST", "/upload", { maxSize: 10_000_000 });
router.cookies("*", "/**", true);   // auto-response headers
```

### CORS

```ts
interface CorsOptions {
  origin?: string | string[] | ((origin: string) => string | undefined);
  methods?: string[];           // default: all common methods
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;              // default: 86400
  preflightContinue?: boolean;
}
```

### Rate Limiting

```ts
interface RateLimitOptions {
  max: number;                           // max requests
  windowMs: number;                      // time window in ms
  keyGenerator?: (req) => string;        // default: x-forwarded-for or x-real-ip
  message?: string;                      // default: "Too many requests"
  headers?: boolean;                     // default: true
}
```

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

### Body Parser

```ts
interface BodyParserOptions {
  json?: boolean;    // default: true
  text?: boolean;    // default: true
  form?: boolean;    // default: true
  limit?: number;    // max bytes
}
```

Parsed body is available at `req.parsedBody`.

### File Upload

```ts
interface FileUploadOptions {
  maxSize?: number;        // max file size in bytes
  allowedTypes?: string[]; // allowed MIME types
}
```

After parsing, use static helpers to access files:

```ts
Router.getFile(req, "avatar");       // UploadedFile | undefined
Router.getFiles(req, "photos");      // UploadedFile[]
Router.getFileFieldNames(req);       // string[]
Router.getFormFields(req);           // Record<string, string>
```

```ts
interface UploadedFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
  blob(): Promise<Blob>;
  stream(): ReadableStream;
}
```

### Server-Sent Events (SSE)

```ts
import { createSSEStream, sse } from "bun-route";

router.get("/events", ({ res }) => {
  const stream = createSSEStream(res);
  stream.sendEvent("message", "Hello");
  stream.send({ event: "update", data: JSON.stringify({ key: "val" }) });
});
```

```ts
interface SSEStream {
  send(message: SSEMessage): void;
  sendEvent(event: string, data: string | string[], id?: string): void;
  sendComment(comment: string): void;
  close(): void;
  isOpen(): boolean;
}
```

### Static Files

```ts
router.static("/**", "./public", "index.html", 10);
```
Parameters: `path`, `targetDir`, `indexFile` (default: `index.html`), `deepestLevel` (default: 10).

Supports ETag caching with `304 Not Modified` responses.

### Redirect

```ts
router.redirect("*", "/old-path", "/new-path");
router.redirect("*", "/old", "/new", true); // permanent (308)
```

### Cookie Parsing

```ts
router.cookies("*", "/**", true); // auto-response headers

// In handlers:
req.cookies.session = "abc123";   // set
req.cookies.session = undefined;  // delete
```

### Request ID

```ts
interface RequestIdOptions {
  header?: string;    // default: "X-Request-Id"
  generator?: (req) => string;  // default: crypto.randomUUID()
}
```

### Timeout

```ts
interface TimeoutOptions {
  timeoutMs: number;
  message?: string;   // default: "Request timeout"
}
```

Sends `408 Request Timeout` if the handler exceeds the time limit.

---

## Request & Response

### Enhanced Request (`req`)

The request object in handlers extends Bun's built-in `Request` with:

| Property | Description |
|----------|-------------|
| `req.path` | URL pathname |
| `req.method` | HTTP method string |
| `req.httpMethod` | `HttpMethod` enum |
| `req.ip` | Client IP |
| `req.ips` | IP chain |
| `req.id` | Request ID (if `requestId` middleware used) |
| `req.parsedBody` | Parsed request body (if `bodyParser` used) |
| `req.cookies` | Parsed cookies object (if `cookies` middleware used) |
| `req.pathParams` | Matched path parameters |
| `req.splitPath` | Path split into segments |
| `req.queryParams` | Query string parameters |
| `req.server` | Bun server reference |
| `req.sock` | Socket address |

### Response Builder (`res`)

| Method | Description |
|--------|-------------|
| `res.send(body)` | Send response |
| `res.json(data, code?)` | JSON response |
| `res.text(data, code?)` | Plain text response |
| `res.html(data, code?)` | HTML response |
| `res.sendFile(file, code?)` | Send a `BunFile` |
| `res.sendRedirect(url, perma?)` | 307 or 308 redirect |
| `res.sendError(msg, code?)` | JSON error response |
| `res.status(code, text?)` | Set status code |
| `res.setHeader(name, value)` | Set response header |
| `res.setCookie(name, value, opts?)` | Set cookie |
| `res.unsetCookie(name)` | Expire cookie |
| `res.beforeSent(hook)` | Add pre-send hook |
| `res.build()` | Build final `Response` |

### Context (`ctx`)

The context object passed to all handlers provides:

| Property/Method | Description |
|----------------|-------------|
| `ctx.req` | Enhanced request |
| `ctx.res` | Response builder |
| `ctx.data` | Extensible per-request data store |
| `ctx.set(key, value)` | Store data |
| `ctx.get(key)` | Retrieve data |
| `ctx.status(code)` | Set status |
| `ctx.json(data, code?)` | JSON response |
| `ctx.text(body, code?)` | Text response |
| `ctx.html(body, code?)` | HTML response |
| `ctx.redirect(url, code?)` | Redirect |
| `ctx.notFound(msg?)` | 404 response |
| `ctx.error(msg, code?)` | Error response |

### Type Safety with ContextDataMap

Augment `ContextDataMap` to get auto-inferred types:

```ts
declare module "bun-route" {
  interface ContextDataMap {
    user: { id: string; role: "admin" | "user" };
  }
}

// ctx.get("user") now returns UserData | undefined
// ctx.set("user", ...) is type-checked
```

---

## Socket.IO Example

A complete Socket.IO chat server is available in [`examples/socket-io/`](./examples/socket-io/). It implements the Engine.IO and Socket.IO wire protocols on top of bun-route's WebSocket support and works with the standard `socket.io-client` on the frontend.

```sh
cd examples/socket-io
bun run server.ts
```

See the [example source](./examples/socket-io/server.ts) for details.

---

## Route Dump & Stats

### Route Table

```ts
console.info(router.dump(server));
// Outputs a formatted table of all routes
```

### Route Listing

```ts
const routes = router.getRoutes();          // excludes middleware
const allRoutes = router.getRoutes(true);   // includes middleware
```

### Performance Stats

```ts
import { trackRouteTime, getRouteStats, clearRouteStats } from "bun-route";

trackRouteTime("GET", "/users", 12.5);
const stats = getRouteStats();   // Map<string, RouteStats>
clearRouteStats();
```

```ts
interface RouteStats {
  requestCount: number;
  totalTimeMs: number;
  avgTimeMs: number;
}
```

When stats are recorded, `router.dump()` includes request count and average response time per route.

---

## Examples

| Example | Description |
|---------|-------------|
| [simple](./examples/simple.ts) | Basic CRUD server |
| [auth-middleware](./examples/auth-middleware.ts) | Auth & role-based authorization |
| [path-params](./examples/path-params.ts) | Wildcard and named parameter patterns |
| [websocket](./examples/websocket.ts) | WebSocket upgrade |
| [cookies](./examples/cookies.ts) | Cookie set/get/clear |
| [redirect](./examples/redirect.ts) | URL redirection |
| [static-serve](./examples/static-serve.ts) | Static file serving |
| [chat-demo](./examples/chat-demo) | Full demo: auth, file upload, WebSocket chat, groups |
| [socket-io](./examples/socket-io) | Socket.IO chat example (rooms, typing, online users) |

---

## TypeScript

This library is written in TypeScript and ships with full type definitions.

### Module Augmentation

```ts
declare module "bun-route" {
  interface ContextDataMap {
    user: { id: string; role: "admin" | "user" };
  }
}
```

---

## Tests

```sh
bun test
```

---

## License

[MIT](LICENSE)
