# Route Dump & Statistics

bun-route provides utilities for inspecting registered routes and tracking performance metrics.

---

## Route Table Dump

### `router.dump(...servers)`

Print a formatted table of all registered routes:

```ts
const server = Bun.serve({ fetch: router.handle });
console.info(router.dump(server));
```

Output:

```
Server is listening on http://localhost:3000

# Defined endpoints:
| Method | Path            | Handler    |
|--------|-----------------|------------|
| GET    | /               | root       |
| GET    | /users          | listUsers  |
| GET    | /users/:id      | getUser    |
| POST   | /users          | createUser |
| GET    | /static/**      | [anonym]   |
```

### Multiple Servers

```ts
const s1 = Bun.serve({ fetch: router.handle, port: 3000 });
const s2 = Bun.serve({ fetch: router.handle, port: 3001 });
console.info(router.dump(s1, s2));
```

Output:

```
Server is listening on:
- http://localhost:3000
- http://localhost:3001
...
```

### Merged Endpoints

When multiple handlers are registered for the same path/method, they are merged. The dump shows both the unmerged (individual) and merged views:

```
# Defined endpoints:
| Method    | Path | Handler |
|-----------|------|---------|
| GET       | /    | logger  |
| ^ (M)     | /    | handler |
| GET       | /    | [merged] |

# Merged endpoints:
| GET | / | [merged] |
```

Lines prefixed with `^ (M)` indicate handlers that are merged into a parent.

---

## Route Listing

### `router.getRoutes(includeMiddleware?)`

Get routes as structured objects:

```ts
// Excludes middleware routes (default)
const routes = router.getRoutes();
// [{ method: "GET", path: "/users" }, ...]

// Includes middleware routes
const allRoutes = router.getRoutes(true);
```

This is useful for:
- Basic endpoint listings
- Debugging what's registered

---

## Structured Route Definitions (Swagger/OpenAPI)

### `router.getRouteDefinitions()`

Returns rich structured metadata suitable for Swagger/OpenAPI generation, API documentation tools, or any use case requiring detailed route introspection.

```ts
const defs = router.getRouteDefinitions();
// [
//   {
//     method: "GET",
//     path: "/users/:id",
//     splitPath: ["users", ":id"],
//     pathParams: [{ name: "id", type: "named", position: 1 }],
//     handlerName: "getUser",
//     middlewareChain: [{ name: "auth", mergedToTop: true }],
//     isMerged: false,
//     stats: { requestCount: 150, totalTimeMs: 2345, avgTimeMs: 15.64 },
//   },
// ]
```

Each definition includes:
| Field | Type | Description |
|-------|------|-------------|
| `method` | `string` | HTTP method (`GET`, `POST`, `PUT`, etc.) |
| `path` | `string` | Route pattern (`/users/:id`, `/files/*`) |
| `splitPath` | `string[]` | Path segments |
| `pathParams` | `RouteParamInfo[]` | Extracted path parameters |
| `handlerName` | `string` | Handler function name |
| `middlewareName` | `string \| undefined` | Middleware identifier (if set) |
| `middlewareChain` | `MiddlewareInfo[]` | Unrolled middleware list |
| `isMerged` | `boolean` | Whether handlers are merged |
| `stats` | `RouteStats \| undefined` | Performance stats (if tracked) |

### `RouteParamInfo`

```ts
interface RouteParamInfo {
  name: string;       // "id", "_0", "wild"
  type: "named" | "wildcard" | "double-wildcard";
  position: number;   // segment index in path
}
```

- `named` → from `:param` segments
- `wildcard` → from `*` segments (auto-named `_0`, `_1`, ...)
- `double-wildcard` → from `**` segments (named `wild`)

### Swagger Example

```ts
const defs = router.getRouteDefinitions();
const swaggerPaths: Record<string, any> = {};

for (const def of defs) {
  const swaggerPath = def.path.replace(/:(\w+)/g, "{$1}");
  
  if (!swaggerPaths[swaggerPath]) {
    swaggerPaths[swaggerPath] = {};
  }

  swaggerPaths[swaggerPath][def.method.toLowerCase()] = {
    parameters: def.pathParams.map((p) => ({
      name: p.name,
      in: p.type === "named" ? "path" : "query",
      required: p.type === "named",
      schema: { type: "string" },
    })),
    summary: def.handlerName,
  };
}
```

### Standalone function

```ts
import { getRouteDefinitions } from "bun-route";

const defs = getRouteDefinitions(router.routes);
```

---

## Performance Stats

### `trackRouteTime(method, path, timeMs)`

Record timing data for a route:

```ts
import { trackRouteTime, getRouteStats, clearRouteStats } from "bun-route";

const start = performance.now();
// ... handle request ...
const elapsed = performance.now() - start;
trackRouteTime("GET", "/users", elapsed);
```

### `getRouteStats()`

Get all recorded statistics:

```ts
const stats = getRouteStats();
// Map<string, RouteStats>
//
// {
//   "GET:/users" => { requestCount: 150, totalTimeMs: 2345.6, avgTimeMs: 15.64 },
//   "POST:/users" => { requestCount: 32, totalTimeMs: 890.1, avgTimeMs: 27.82 },
// }
```

### `clearRouteStats()`

Reset all statistics:

```ts
clearRouteStats();
```

### `RouteStats` Interface

```ts
interface RouteStats {
  requestCount: number;
  totalTimeMs: number;
  avgTimeMs: number;
}
```

---

### Stats in Route Dump

When stats are recorded, `router.dump()` automatically includes them:

```
# Defined endpoints:
| Method | Path       | Handler    | Requests | Avg Time |
|--------|------------|------------|----------|----------|
| GET    | /users     | listUsers  | 150      | 15.64ms  |
| POST   | /users     | createUser | 32       | 27.82ms  |
| GET    | /users/:id | getUser    | 89       | 12.31ms  |
```

---

## Utility Types

```ts
type SplitPath = [string, ...string[]] | undefined

interface EndpointRoute {
  handler: RequestMiddleware;
  method: HttpMethod;
  splitPath: SplitPath;
  middlewareName?: string;
}
```
