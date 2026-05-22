# Middleware Reference

router-bun includes a rich set of built-in middleware that can be applied as direct router methods or as standalone functions.

---

## CORS

### Router Method

```ts
router.cors("*", "/api/**", {
  origin: "https://myapp.com",
  methods: ["GET", "POST"],
  credentials: true,
  maxAge: 3600,
});
```

### Options

```ts
interface CorsOptions {
  origin?: string | string[] | ((origin: string) => string | undefined);
  methods?: string[];              // default: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"]
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;           // default: false
  maxAge?: number;                 // default: 86400 (24h)
  preflightContinue?: boolean;     // default: false
}
```

### Behavior

- Sets `Access-Control-Allow-Origin` header
- Handles OPTIONS preflight requests
- When `origin` is a function, it receives the request origin and should return the allowed origin or `undefined`
- `preflightContinue: true` passes the preflight through to the next handler

### Direct Import

```ts
import { cors } from "router-bun";
cors(router.routes, "*", "/**", { origin: "*" });
```

---

## Rate Limiting

### Router Method

```ts
router.rateLimit("POST", "/api/auth", {
  max: 5,
  windowMs: 60000,
  message: "Too many login attempts",
  headers: true,
});
```

### Options

```ts
interface RateLimitOptions {
  max: number;                              // max requests per window
  windowMs: number;                         // window duration in ms
  keyGenerator?: (req: Request) => string;  // default: x-forwarded-for or x-real-ip
  message?: string;                         // default: "Too many requests"
  headers?: boolean;                        // default: true (sets rate limit headers)
}
```

### Behavior

- In-memory storage with periodic cleanup
- Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- Sends `Retry-After` header when rate limited
- Returns `429 Too Many Requests` when limit exceeded

---

## Body Parser

### Router Method

```ts
router.body("*", "/api/*", {
  json: true,
  form: true,
  text: true,
  limit: 1_000_000,  // 1MB max
});
```

### Options

```ts
interface BodyParserOptions {
  json?: boolean;    // default: true
  text?: boolean;    // default: true
  form?: boolean;    // default: true
  limit?: number;    // max bytes to read
}
```

### Behavior

- Automatically parses based on `Content-Type` header
- Parsed body stored in `req.parsedBody`
- JSON → `application/json`
- Form → `application/x-www-form-urlencoded`
- Text → fallback for all other types
- `limit` truncates the body if specified

---

## File Upload

### Router Method

```ts
router.fileUpload("POST", "/upload", {
  maxSize: 10_000_000,         // 10MB
  allowedTypes: ["image/jpeg", "image/png"],
});
```

### Options

```ts
interface FileUploadOptions {
  maxSize?: number;         // max file size in bytes
  allowedTypes?: string[];  // allowed MIME types (partial match: "image/" matches "image/png")
}
```

### Accessing Files

After the middleware runs, use the static helpers to retrieve files:

```ts
router.post("/upload", (ctx) => {
  const avatar = Router.getFile(ctx.req, "avatar");
  if (avatar) {
    const buffer = await avatar.arrayBuffer();
    // save to disk...
  }
  const fields = Router.getFormFields(ctx.req);  // non-file fields
});
```

### `UploadedFile` Interface

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

### Static Helpers

```ts
Router.getFile(req, "fieldName");         // UploadedFile | undefined
Router.getFiles(req, "fieldName");        // UploadedFile[]
Router.getFileFieldNames(req);            // string[]
Router.getFormFields(req);                // Record<string, string>
```

---

## Server-Sent Events (SSE)

### Creating an SSE Stream

```ts
import { createSSEStream } from "router-bun";

router.get("/events", ({ res }) => {
  const stream = createSSEStream(res);

  stream.send({
    event: "message",
    data: "Hello via SSE!",
    id: "1",
    retry: 3000,
  });

  stream.sendEvent("update", JSON.stringify({ key: "val" }));

  stream.sendComment("this is a comment");

  // close after 10 seconds
  setTimeout(() => stream.close(), 10000);
});
```

### `SSEStream` Interface

```ts
interface SSEStream {
  send(message: SSEMessage): void;
  sendEvent(event: string, data: string | string[], id?: string): void;
  sendComment(comment: string): void;
  close(): void;
  isOpen(): boolean;
}

interface SSEMessage {
  event?: string;
  data: string | string[];
  id?: string;
  retry?: number;
}
```

### Helper Function

```ts
import { sse } from "router-bun";

router.get("/stream", ({ res }) => {
  sse(res, async (stream) => {
    stream.sendEvent("connected", "SSE established");
    // ... send more events
  });
});
```

---

## Static Files

### Router Method

```ts
router.static("/**", "./public", "index.html", 10);
```

### Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `path` | — | URL path pattern (e.g., `/**`, `/static/**`) |
| `targetDir` | — | Directory on disk to serve files from |
| `indexFile` | `"index.html"` | Default file for directory roots |
| `deepestLevel` | `10` | Maximum path depth to serve |

### Behavior

- Serves files from the target directory matching the URL path
- `index.html` is served for directory roots
- ETag-based caching with `304 Not Modified` responses
- Redirects `/dir/index.html` to `/dir/`
- Validates the target directory exists at registration time

---

## Redirect

### Router Method

```ts
// Temporary redirect (307)
router.redirect("*", "/old-path", "/new-path");

// Permanent redirect (308)
router.redirect("*", "/old-path", "/new-path", true);
```

Redirects can target external URLs too:

```ts
router.redirect("*", "/google", "https://google.com");
```

---

## Cookie Parsing

### Router Method

```ts
// With auto-response headers (set/delete cookies via req.cookies)
router.cookies("*", "/**", true);

// Without auto-response headers (read-only)
router.cookies("*", "/**");
```

### In Handlers

```ts
router.get("/set", ({ req, res }) => {
  req.cookies.session = "abc123";     // set cookie
  req.cookies.visited = "true";       // another cookie
});

router.get("/clear", ({ req, res }) => {
  req.cookies.session = undefined;    // delete cookie
  req.cookies = {};                   // clear all cookies
});

router.get("/show", ({ req, res }) => {
  res.json(req.cookies);              // read all cookies
});
```

### Static Helpers

```ts
Router.parseCookies(req);
Router.storeCookies(req, res);
```

---

## Request ID

### Router Method

```ts
router.requestId("*", "/**", {
  header: "X-Trace-Id",
  generator: () => `req_${Date.now()}`,
});
```

### Options

```ts
interface RequestIdOptions {
  header?: string;                            // default: "X-Request-Id"
  generator?: (req: { headers: Headers }) => string;  // default: crypto.randomUUID()
}
```

### Behavior

- Sets `req.id` on the request
- Adds the header to the response
- Reuses existing request ID if the client sends one in the same header

---

## Timeout

### Router Method

```ts
router.timeout("POST", "/api/slow", {
  timeoutMs: 5000,
  message: "Request took too long",
});
```

### Options

```ts
interface TimeoutOptions {
  timeoutMs: number;
  message?: string;   // default: "Request timeout"
}
```

### Behavior

- Sets a timer that sends `408 Request Timeout` if the handler doesn't complete in time
- Automatically cancels the timer when the response is sent
- Uses `beforeSent` hooks for clean integration
