# Router API Reference

## Constructor

```ts
import { Router } from "router-bun";

const router = new Router();
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `routes` | `EndpointRoute[]` | `[]` | All registered routes |
| `mergeHandlers` | `boolean` | `true` | Auto-merge handlers for same path/method |
| `handle` | `BunRequestHandler` | (function) | Fetch handler for `Bun.serve` |

### Static Properties

| Property | Description |
|----------|-------------|
| `Router.parseCookies` | Parse cookies from request |
| `Router.storeCookies` | Store cookies in response |
| `Router.getFile` | Get uploaded file by field name |
| `Router.getFiles` | Get all uploaded files for a field |
| `Router.getFileFieldNames` | Get all uploaded file field names |
| `Router.getFormFields` | Get non-file form fields |

---

## Route Registration

All HTTP method handlers have the same signature:

```ts
router.get(path: string, handler: RequestMiddleware, ...handlers: RequestMiddleware[]): Router
router.post(path, handler, ...handlers): Router
router.put(path, handler, ...handlers): Router
router.delete(path, handler, ...handlers): Router
router.patch(path, handler, ...handlers): Router
router.options(path, handler, ...handlers): Router
router.head(path, handler, ...handlers): Router
router.trace(path, handler, ...handlers): Router
router.connect(path, handler, ...handlers): Router
```

All methods return `this` for chaining.

### `use(method, path, handler, ...handlers)`

Register a handler that matches any HTTP method:

```ts
router.use("*", "/api/*", authMiddleware);
router.use("*", "/**", loggingMiddleware);
```

The `method` parameter accepts `"*"` (all methods) or any specific method string.

---

## Route Organization

### `group(prefix, callback)`

Create a group of routes sharing a common prefix:

```ts
router.group("/api", (r) => {
  r.get("/users", listUsers);
  r.post("/users", createUser);
  r.get("/users/:id", getUser);
  r.put("/users/:id", updateUser);
  r.delete("/users/:id", deleteUser);
});
```

Groups can be nested:

```ts
router.group("/api", (api) => {
  api.group("/v1", (v1) => {
    v1.get("/users", listUsers);
  });
  api.group("/v2", (v2) => {
    v2.get("/users", listUsersV2);
  });
});
```

### `mount(prefix, subRouter)`

Mount an entire router instance at a prefix:

```ts
const adminRouter = new Router();
adminRouter.get("/users", adminList);
adminRouter.get("/settings", adminSettings);

router.mount("/admin", adminRouter);
// Registers: GET /admin/users, GET /admin/settings
```

---

## Built-in Middleware Registration

These methods register built-in middleware on the router:

```ts
router.ws(path: string): Router
router.redirect(method, path, target, perma?): Router
router.static(path, targetDir, indexFile?, deepestLevel?): Router
router.cookies(method, path, autoResponseHeaders?): Router
router.cors(method, path, options?): Router
router.body(method, path, options?): Router
router.rateLimit(method, path, options): Router
router.requestId(method, path, options?): Router
router.timeout(method, path, options): Router
router.fileUpload(method, path, options?): Router
```

All return `this` for chaining.

---

## Error Handling

### `onError(handler)`

Register a global error handler:

```ts
router.onError((err: Error, ctx: Context) => {
  console.error(err);
  ctx.res.status(500).json({ error: err.message });
});
```

Type: `(err: Error, ctx: Context) => Awaitable<void>`

---

## WebSocket

### `ws(path)`

Register a WebSocket upgrade handler:

```ts
router.ws("/ws");
// Requires Bun.serve websocket config
```

### `setWebSocketHandlers(handlers)`

Set the WebSocket event handlers for `Bun.serve`:

```ts
router.setWebSocketHandlers({
  open(ws) {},
  message(ws, msg) {},
  close(ws) {},
  drain(ws) {},
});
```

### `getWebSocketHandlers()`

Get the registered WebSocket handlers:

```ts
const handlers = router.getWebSocketHandlers();
```

---

## Route Inspection

### `dump(...servers)`

Print a formatted route table:

```ts
console.info(router.dump(server));
// Optionally pass Bun.serve instances to show URLs
```

### `getRoutes(includeMiddleware?)`

Get all routes as structured objects:

```ts
const routes = router.getRoutes();
// [{ method: "GET", path: "/users" }, ...]

const allRoutes = router.getRoutes(true);
// Includes middleware routes
```

---

## Direct Request Testing

### `request(request, options?)`

Send a request directly to the router without an HTTP server:

```ts
// Using a URL string
const res = await router.request("/api/users");
const data = await res.json();

// Using a full Request object
const res = await router.request("http://test/api/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Alice" }),
});

// Relative URLs are resolved against http://localhost
const res = await router.request("/api/users/42");
```

---

## Full TypeScript Types

```ts
interface EndpointRoute {
  handler: RequestMiddleware;
  method: HttpMethod;
  splitPath: SplitPath;
  middlewareName?: string;
}

type RequestMiddleware = (ctx: Context) => void | Response | Promise<void | Response>;

type ErrorHandler = (err: Error, ctx: Context) => Awaitable<void>;

interface BunRequestHandler {
  (request: Request, server: Server<WebSocketData>): Awaitable<Response>;
}
```
