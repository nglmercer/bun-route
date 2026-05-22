# Getting Started with bun-route

A step-by-step guide to building your first bun-route server.

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- A Bun project (`bun init` or existing)

## Installation

```sh
bun add bun-route
```

## Your First Server

Create `server.ts`:

```ts
import { Router } from "bun-route";

const app = new Router();

app.get("/", ({ res }) => {
  res.send("Hello, world!");
});

app.get("/hello/:name", ({ req, res }) => {
  const name = req.pathParam("name").string();
  res.json({ message: `Hello, ${name}!` });
});

Bun.serve({ fetch: app.handle });
```

Run it:

```sh
bun run server.ts
```

Visit `http://localhost:3000` — your server is running.

## Adding Middleware

```ts
import { Router } from "bun-route";

const app = new Router();

// Request ID for every request
app.requestId("*", "/**");

// CORS for API routes
app.cors("*", "/api/**", { origin: "*" });

// Parse JSON bodies
app.body("*", "/api/*", { json: true });

app.post("/api/data", ({ req, res }) => {
  res.json({ received: req.parsedBody });
});

Bun.serve({ fetch: app.handle });
```

## Route Groups

Organize related routes with `group()`:

```ts
app.group("/api/v1", (api) => {
  api.get("/users", listUsers);
  api.post("/users", createUser);
  api.get("/users/:id", getUser);
});
// Registers: GET /api/v1/users, POST /api/v1/users, GET /api/v1/users/:id
```

## WebSocket Support

```ts
import { Router } from "bun-route";

const app = new Router();

app.get("/", ({ res }) => res.file(Bun.file("./index.html")));
app.ws("/ws");

Bun.serve({
  fetch: app.handle,
  websocket: {
    open(ws) {
      ws.subscribe("chat");
    },
    message(ws, msg) {
      ws.publish("chat", `${ws.remoteAddress}: ${msg}`);
    },
    close(ws) {
      ws.unsubscribe("chat");
    },
  },
});
```

## Error Handling

```ts
app.onError((err, { req, res }) => {
  console.error(`[${req.method} ${req.path}]`, err);
  res.status(500).json({ error: "Internal error" });
});
```

## Testing Routes Directly

No need to start a server for tests:

```ts
const res = await app.request("/hello/world", { method: "GET" });
const body = await res.json();
// { message: "Hello, world!" }
```

## Viewing Registered Routes

```ts
const server = Bun.serve({ fetch: app.handle });
console.info(app.dump(server));
// Outputs a formatted route table:
//
// Server is listening on http://localhost:3000
//
// # Defined endpoints:
// | Method | Path            | Handler    |
// |--------|-----------------|------------|
// | GET    | /               | [anonym]   |
// | GET    | /hello/:name    | [anonym]   |
// | POST   | /api/data       | [anonym]   |
```

## Next Steps

- [Router API Reference](./router-api.md) — full API details
- [Middleware Guide](./middleware.md) — CORS, rate limiting, file uploads, SSE
- [Routing Patterns](./routing.md) — wildcards, named params, groups
- [Request & Response](./request-response.md) — Context, ResponseBuilder
- [Socket.IO example](../examples/socket-io/) — Socket.IO chat server
