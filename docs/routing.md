# Routing

bun-route supports Express-like routing with wildcards, named parameters, route groups, and sub-router mounting.

---

## Basic Routes

```ts
router.get("/", handler);
router.post("/users", handler);
router.put("/users/:id", handler);
router.delete("/users/:id", handler);
```

---

## Path Patterns

| Pattern | Meaning | Examples |
|---------|---------|---------|
| `/users/:id` | Named parameter — captures one segment | `/users/42`, `/users/abc` |
| `/files/*` | Single wildcard — matches exactly one segment | `/files/doc`, `/files/image.png` |
| `/files/**` | Double wildcard — matches zero or more segments | `/files`, `/files/a/b/c` |
| `/static/**` | Common pattern for static file serving | `/static/css/main.css` |
| `/*/*/**` | Combined: 2 required segments + unlimited optional | `/a/b/c/d/e` |

### Named Parameters (`:param`)

```ts
router.get("/users/:userId/posts/:postId", ({ req, res }) => {
  // Access via typed accessor
  const userId = req.pathParam("userId").int();
  const postId = req.pathParam("postId").string();

  // Or raw via req.pathParams
  res.json(req.pathParams as Record<string, string>);
});
```

### Single Wildcard (`*`)

Matches exactly one path segment:

```ts
// Matches: /files/readme.txt, /files/photo.png
// Does NOT match: /files, /files/sub/readme.txt
router.get("/files/*", ({ req, res }) => {
  const [filename] = req.pathParams as string[];
  res.json({ filename });
});
```

### Double Wildcard (`**`)

Matches zero or more path segments, must be the last segment:

```ts
// Matches: /static, /static/css, /static/css/main.css
// Does NOT match: /static/css/main.css/extra (if at end)
router.get("/static/**", ({ req, res }) => {
  // req.pathParams contains all trailing segments as string[]
  res.json({ path: req.pathParams });
});
```

### Combined Patterns

```ts
// Minimum 2 fixed params + unlimited extras
// Matches: /files/a/b, /files/a/b/c, /files/a/b/c/d
// Does NOT match: /files/a
router.get("/files/*/*/**", ({ req, res }) => {
  const [first, second, ...rest] = req.pathParams as string[];
  res.json({ first, second, rest });
});
```

---

## Route Groups

### `group(prefix, callback)`

Create a group of routes with a shared prefix:

```ts
router.group("/api", (api) => {
  api.get("/users", listUsers);
  api.post("/users", createUser);
  api.get("/users/:id", getUser);
  api.put("/users/:id", updateUser);
  api.delete("/users/:id", deleteUser);
});
// Registers:
//   GET    /api/users
//   POST   /api/users
//   GET    /api/users/:id
//   PUT    /api/users/:id
//   DELETE /api/users/:id
```

### Nested Groups

```ts
router.group("/api", (api) => {
  api.group("/v1", (v1) => {
    v1.get("/users", listUsersV1);
  });
  api.group("/v2", (v2) => {
    v2.get("/users", listUsersV2);
  });
});
// Registers:
//   GET /api/v1/users
//   GET /api/v2/users
```

### Groups with Middleware

```ts
router.group("/api", (api) => {
  // Apply auth to all /api routes
  api.use("*", "/**", authMiddleware);

  api.get("/users", listUsers);     // protected
  api.get("/public", publicHandler); // also protected due to parent prefix
});
```

---

## Sub-router Mounting

### `mount(prefix, subRouter)`

Mount an entire router at a prefix:

```ts
const admin = new Router();
admin.get("/users", adminListUsers);
admin.get("/settings", adminSettings);
admin.group("/dashboard", (d) => {
  d.get("/", adminDashboard);
});

router.mount("/admin", admin);
// Registers:
//   GET /admin/users
//   GET /admin/settings
//   GET /admin/dashboard
```

Sub-routers can have their own middleware and error handlers:

```ts
const api = new Router();
api.onError((err, ctx) => ctx.res.status(500).json({ error: "API error" }));
api.use("*", "/**", apiKeyMiddleware);
api.get("/data", handler);

router.mount("/api/v1", api);
```

---

## Middleware Registration

### `use(method, path, handler, ...handlers)`

Register a middleware for all methods:

```ts
router.use("*", "/**", loggingMiddleware);
router.use("*", "/api/*", authMiddleware);
```

### Chaining Multiple Handlers

```ts
router.get(
  "/admin/users",
  authMiddleware,        // runs first
  requireRole("admin"),  // runs second
  listUsers,             // runs last
);
```

When multiple handlers are provided, they are merged into a single execution chain. If any handler sends a response (`res.submit = true`) or upgrades the request (`req.upgraded = true`), subsequent handlers are skipped.

---

## Path Matching Details

### How Paths Are Matched

1. The request path is split into segments: `/users/42` → `["users", "42"]`
2. Each route's path pattern is split the same way: `/users/:id` → `["users", ":id"]`
3. Segments are compared one by one:
   - Exact string match
   - `*` matches any single segment
   - `**` matches any remaining segments (must be last)
   - `:name` matches any single segment and captures its value

### Priority / Order

Routes are matched in registration order. The first matching route handles the request. If no route matches, a `404 Not Found` response is returned.

### `**` Validation

The double wildcard `**` is validated at registration time. It must be the last segment in the path pattern — otherwise an error is thrown:

```ts
router.get("/a/**/b", handler);
// Throws: "Invalid router path, ** must be the last part"
```

---

## Direct Request Testing

```ts
// Test routes without starting a server
const res = await router.request("/api/users", { method: "GET" });
const data = await res.json();
```

The `request()` method supports:
- Relative URLs (prepended with `http://localhost`)
- Full URLs
- Custom `RequestInit` options
- Returns a standard `Response` object
