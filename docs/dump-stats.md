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
- API documentation generation
- Building dynamic endpoint listings
- Debugging what's registered

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
