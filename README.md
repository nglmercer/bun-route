# bun-route

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![npm](https://img.shields.io/npm/v/bun-route.svg?style=plastic&logo=npm&color=red)

**A fast, Express-like router for `bun.serve()` with native Socket.IO support.**

`bun-route` leverages Bun's `bun.serve()` to deliver a fast, familiar routing experience. It provides an Express-like API with built-in middleware for CORS, rate limiting, file uploads, SSE, and a **zero-dependency native Socket.IO implementation**.

## features

### Routing
- Wildcards — single (`*`) and double (`**`) wildcard path matching
- Named params (`:id`) with typed accessors
- Route groups with prefix (`router.group("/api", ...)`)
- Sub-router mounting (`router.mount("/api", subRouter)`)
- Route table dump (`router.dump()`)

### Middleware
- **CORS** — configurable origins, methods, headers, credentials
- **Rate limiting** — in-memory with custom key gen
- **File upload** — multipart form parsing
- **SSE** — server-sent events stream
- **Request ID** — auto-generated X-Request-Id
- **Body parser** — JSON, text, form
- **Timeout** — request timeout with 408
- **Cookie parsing** — with auto-response headers
- **WebSocket** — native Bun WebSocket upgrade
- **Static files** — directory serving with ETag

### Real-time (Socket.IO compatible)
- **Zero external dependencies** — implements Engine.IO + Socket.IO protocols from scratch
- **Dual transport** — HTTP long-polling and WebSocket (via `Bun.serve`)
- **Full event system** — `.emit()`, `.on()`, ACK callbacks
- **Rooms** — `.join()`, `.leave()`, `.to(room).emit()`, broadcast
- **Works with `socket.io-client`** — fully compatible with the standard client library

```ts
import { SioServer } from "./examples/socket-io/adapter"

const io = new SioServer({ path: "/socket.io" })
io.attach(router.routes)

io.on("connection", (socket) => {
  socket.on("chat:message", (text) => {
    io.to("general").emit("chat:message", { text })
  })
})

Bun.serve({
  fetch: router.handle,
  websocket: io.ws,
})
```

## usage

### install

```sh
npm i bun-route
```

### basic server

```ts
import { Router } from "bun-route";

const router = new Router();

router.get("/", ({ res }) => {
  res.send("Hello!");
});

const server = Bun.serve({
  fetch: router.handle,
});

console.info(router.dump(server));
```

## examples

Check the [examples](./examples) directory:
- [simple](./examples/simple.ts) — basic CRUD
- [websocket](./examples/websocket.ts) — WS upgrade
- [cookies](./examples/cookies.ts) — cookie set/get/clear
- [redirect](./examples/redirect.ts) — URL redirection
- [static-serve](./examples/static-serve.ts) — static files
- [chat-demo](./examples/chat-demo) — full chat app with auth, uploads
- **Socket.IO chat** — [`examples/socket-io/server.ts`](./examples/socket-io/server.ts) — real-time chat with rooms

## tests

```sh
bun test
```

## license

[MIT](LICENSE)
