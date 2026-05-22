# Introducing bun-route: A Fast, Express-like Router for Bun

*Published May 2026*

If you're building web applications with [Bun](https://bun.sh), the modern JavaScript runtime, you already know how fast it is. Bun's built-in `bun.serve()` is lightweight and performant, but building real applications requires routing — and that's where **bun-route** comes in.

## What is bun-route?

**bun-route** is a fast, Express-like router purpose-built for `bun.serve()`. It provides the familiar API you know from Express while embracing Bun-specific features like native WebSockets, `Bun.file()`, and `Bun.CryptoHasher`.

A complete Socket.IO chat server example is also included in the repository, demonstrating real-time communication on top of Bun's native WebSockets.

## Why bun-route?

### 1. Familiar Express-like API

If you know Express, you know bun-route:

```ts
import { Router } from "bun-route";

const app = new Router();

app.get("/users", listUsers);
app.post("/users", createUser);
app.get("/users/:id", getUser);
```

### 2. Built for Bun from the ground up

Unlike wrapping Express in a Bun adapter, bun-route is designed specifically for `bun.serve()`:

```ts
Bun.serve({ fetch: app.handle });
```

No translation layer, no performance tax — just direct integration.

### 3. Rich middleware ecosystem

Out of the box, bun-route includes:

- **CORS** with configurable origins, methods, and credentials
- **Rate limiting** with in-memory storage and configurable windows
- **File upload** with multipart form parsing, size limits, and type filtering
- **SSE** (Server-Sent Events) for real-time streaming
- **Request ID** generation for tracing
- **Body parsing** for JSON, form, and text payloads
- **Request timeout** with configurable duration
- **Cookie parsing** with automatic response header management
- **Static file serving** with ETag caching

### 4. Advanced routing patterns

bun-route supports the full range of path patterns:

```ts
// Named parameters
router.get("/users/:id", handler);

// Single wildcard — matches exactly one segment
router.get("/files/*", handler);

// Double wildcard — matches zero or more segments
router.get("/static/**", handler);

// Combined patterns
router.get("/api/v:version/**", handler);

// Route groups with shared prefixes
router.group("/api", (api) => {
  api.get("/users", listUsers);
  api.post("/users", createUser);
});

// Mount sub-routers
router.mount("/admin", adminRouter);
```

### 5. Socket.IO example

A complete Socket.IO chat server implementation is available in the [examples/socket-io](../examples/socket-io/) directory. It implements the Engine.IO and Socket.IO wire protocols on top of bun-route's WebSocket support and works with the standard `socket.io-client`.

```sh
cd examples/socket-io
bun run server.ts
```

## Performance

bun-route is designed for performance:

- **Direct integration** with `bun.serve()` — no middleware translation layers
- **Efficient path matching** — paths are pre-split and compared segment-by-segment
- **Handler merging** — multiple handlers for the same path/method are merged into a single execution chain
- **Built-in route timing** — track and display per-route performance metrics

## Getting Started

```sh
bun add bun-route
```

```ts
import { Router } from "bun-route";

const router = new Router();

router.get("/", ({ res }) => {
  res.send("Hello from bun-route!");
});

Bun.serve({ fetch: router.handle });
```

## TypeScript First

Full type definitions ship with the package. Augment `ContextDataMap` for type-safe data sharing between middleware:

```ts
declare module "bun-route" {
  interface ContextDataMap {
    user: { id: string; role: "admin" | "user" };
  }
}

// ctx.get("user") is fully typed
```

## Conclusion

bun-route brings the best of Express to Bun — familiar API, rich middleware, and powerful routing patterns. Whether you're building a simple API, a real-time chat app, or a full-featured web application, bun-route gives you the tools you need without compromise.

---

*Ready to try it? [Check out the docs](../README.md) or dive into the [examples](../examples/).*
