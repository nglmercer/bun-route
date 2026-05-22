# Request & Response

bun-route provides a rich request object and a builder-pattern response API.

## Context (`ctx`)

Every handler receives a `Context` object with `req`, `res`, and data utilities:

```ts
router.get("/hello", (ctx) => {
  ctx.res.json({ path: ctx.path, method: ctx.method });
});
```

### Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `ctx.req` | `Request` | Enhanced request (see below) |
| `ctx.res` | `ResponseBuilder` | Response builder (see below) |
| `ctx.data` | `Record<string, unknown>` | Per-request data store |
| `ctx.url` | `URL` | Parsed request URL |
| `ctx.method` | `string` | HTTP method |
| `ctx.headers` | `Headers` | Request headers |
| `ctx.path` | `string` | URL pathname |

### Context Methods

| Method | Description |
|--------|-------------|
| `ctx.set(key, value)` | Store data in context |
| `ctx.get(key)` | Retrieve data from context |
| `ctx.status(code)` | Set response status code (returns `this`) |
| `ctx.json(data, code?)` | Send JSON response |
| `ctx.text(body, code?)` | Send text response |
| `ctx.html(body, code?)` | Send HTML response |
| `ctx.redirect(url, code?)` | Redirect (default: 307) |
| `ctx.notFound(msg?)` | Send 404 response |
| `ctx.error(msg, code?)` | Send error response (default: 500) |
| `ctx.build()` | Build and return the `Response` object |

---

## Enhanced Request (`req`)

The request object extends Bun's built-in `Request`:

```ts
router.get("/users/:id", ({ req, res }) => {
  // Extended properties:
  console.log(req.path);          // "/users/42"
  console.log(req.ip);            // "::1"
  console.log(req.httpMethod);    // HttpMethod.GET (enum)
  console.log(req.queryParams);   // { page: "1" }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `req.path` | `string` | URL pathname |
| `req.method` | `string` | HTTP method string |
| `req.httpMethod` | `HttpMethod` | `HttpMethod` enum value |
| `req.ip` | `string` | Client IP address |
| `req.ips` | `string[]` | IP chain (x-forwarded-for) |
| `req.id` | `string \| undefined` | Request ID (requires `requestId` middleware) |
| `req.parsedBody` | `unknown` | Parsed body (requires `bodyParser` middleware) |
| `req.cookies` | `Record<string, string \| undefined>` | Parsed cookies (requires `cookies` middleware) |
| `req.pathParams` | `PathParams` | Matched path parameters |
| `req.splitPath` | `SplitPath` | Path split into segments |
| `req.queryParams` | `Record<string, string>` | Query string parameters |
| `req.server` | `Server<WebSocketData>` | Bun server reference |
| `req.sock` | `SocketAddress` | Remote socket address |
| `req.upgraded` | `true \| undefined` | Whether the request was upgraded to WebSocket |

### Path Parameters

```ts
router.get("/users/:id/posts/:postId", ({ req, res }) => {
  // Using typed accessor:
  const id = req.pathParam("id").int();           // number | undefined
  const postId = req.pathParam("postId").require(); // string (throws)

  // Raw access:
  // req.pathParams — Record<string, string> or string[]
});
```

### Query Parameters

```ts
router.get("/search", ({ req, res }) => {
  const q = req.queryParam("q").string();
  const page = req.queryParam("page").int() ?? 1;
  const sort = req.queryParam("sort").enum(["asc", "desc"]) ?? "asc";
  const tags = req.queryParam("tags").array();

  res.json({ q, page, sort, tags });
});
```

### `Param` Typed Accessor

Both `req.queryParam()` (query) and `req.pathParam()` (path) return the same `Param` class:

| Method | Returns | Description |
|--------|---------|-------------|
| `.string()` | `string \| undefined` | Value as string |
| `.int()` | `number \| undefined` | Integer value |
| `.number()` | `number \| undefined` | Numeric value |
| `.numberBetween(min, max)` | `number \| undefined` | Clamped number |
| `.boolean()` | `boolean \| undefined` | `"true"`/`"1"` → `true`, `"false"`/`"0"` → `false` |
| `.enum(allowed)` | `T \| undefined` | Only returns if value matches one of the allowed values |
| `.require(name?)` | `string` | Returns value or throws |
| `.exists()` | `boolean` | Whether the param is present |
| `.or(default)` | `string` | Value or fallback default |
| `.array()` | `string[]` | All values as an array |
| `.rawValue()` | `string \| string[] \| undefined` | Unprocessed raw value |

### Cookies

```ts
// Requires cookies middleware
router.cookies("*", "/**", true);

router.get("/profile", ({ req }) => {
  const session = req.cookies.session;
  // req.cookies — Record<string, string | undefined>
});
```

---

## Response Builder (`res`)

The response builder uses a fluent pattern with immediate submission for terminal methods.

### Status & Headers

```ts
router.get("/custom", ({ res }) => {
  res
    .status(201, "Created")
    .setHeader("X-Custom", "value")
    .setCookie("session", "abc123", {
      HttpOnly: true,
      Secure: true,
      Path: "/",
      MaxAge: 3600,
      SameSite: "Lax",
    })
    .json({ ok: true });
});
```

### Response Methods

| Method | Description |
|--------|-------------|
| `res.send(body?)` | Submit response with body |
| `res.json(data, code?)` | JSON response (Content-Type: application/json) |
| `res.text(data, code?)` | Plain text (Content-Type: text/plain) |
| `res.html(data, code?)` | HTML response (Content-Type: text/html) |
| `res.sendFile(file, code?)` | Send a `BunFile` |
| `res.sendNoContent()` | 204 No Content |
| `res.sendError(msg, code?)` | JSON error `{ error, status }` |
| `res.sendRedirect(url, perma?)` | 307 (temporary) or 308 (permanent) redirect |
| `res.sendRedirectCustom(url, status)` | Redirect with custom status |
| `res.status(code, text?)` | Set status code (returns `this`) |
| `res.setHeader(name, value, overwrite?)` | Set response header |
| `res.unsetHeader(name)` | Remove a header |
| `res.setCookie(name, value, opts?)` | Set a cookie |
| `res.unsetCookie(name)` | Expire a cookie |
| `res.body(bodyInit?)` | Set response body (returns `this`) |
| `res.beforeSent(hook)` | Add pre-send hook |
| `res.build()` | Build and return the `Response` object |
| `res.clone()` | Deep clone the builder state |
| `res.reset()` | Reset to default state |

### Aliases

| Alias | Original |
|-------|----------|
| `res.json` | `res.sendJson` |
| `res.text` | `res.sendText` |
| `res.html` | `res.sendHtml` |
| `res.error` | `res.sendError` |
| `res.file` | `res.sendFile` |
| `res.noContent` | `res.sendNoContent` |

### beforeSent Hooks

Add hooks that run just before the response is built. Useful for logging or modifying the response:

```ts
router.use("*", "/**", ({ res }) => {
  res.beforeSent((res) => {
    console.log(`Response: ${res.statusCode}`);
  });
});
```

Multiple hooks can be registered and run in order.

### HTTP Status Constants

```ts
import { HTTP_STATUS } from "bun-route";

HTTP_STATUS.OK                    // 200
HTTP_STATUS.NO_CONTENT            // 204
HTTP_STATUS.TEMPORARY_REDIRECT    // 307
HTTP_STATUS.PERMANENT_REDIRECT    // 308
HTTP_STATUS.UNAUTHORIZED          // 401
HTTP_STATUS.FORBIDDEN             // 403
HTTP_STATUS.NOT_FOUND             // 404
HTTP_STATUS.REQUEST_TIMEOUT       // 408
HTTP_STATUS.TOO_MANY_REQUESTS     // 429
HTTP_STATUS.INTERNAL_SERVER_ERROR // 500
```

---

## Type Safety with ContextDataMap

Augment the `ContextDataMap` interface to get typed `ctx.get()` and `ctx.set()`:

```ts
// types.ts
declare module "bun-route" {
  interface ContextDataMap {
    user: { id: string; role: "admin" | "user"; email: string };
  }
}

// handlers.ts
router.get("/profile", auth, (ctx) => {
  const user = ctx.get("user");         // UserData | undefined — fully typed
  ctx.set("user", { id: "1", role: "admin", email: "a@b.com" });  // type-checked
});
```

This is the recommended approach for passing data between middleware and handlers.
