/**
 * Route params (path + query) demo
 *
 * Shows req.pathParam(), req.queryParam(), Param class
 *
 * Run:  bun run examples/path-params.ts
 * Test: curl http://localhost:3005/...
 */

import { Router, handlerName } from "../src/index";

const router = new Router();

// ─── Named path params ────────────────────────────────────────

// Try:  curl http://localhost:3005/users/42
//       → "pathParam('id') = 42"
router.get("/users/:id", handlerName("getUser", ({ req, res }) => {
  const id = req.pathParam("id").string();
  res.send(`pathParam('id') = ${id}`);
}));

// Try:  curl http://localhost:3005/items/books/99
//       → "category=books  item=99"
router.get("/items/:category/:itemId", ({ req, res }) => {
  const cat = req.pathParam("category").string();
  const item = req.pathParam("itemId").string();
  res.send(`category=${cat}  item=${item}`);
});

// ─── Wildcard path params ─────────────────────────────────────

// Single wildcard — exactly one segment
// Try:  curl http://localhost:3005/get/hello
//       → "pathParam('0') = hello"
router.get("/get/*", ({ req, res }) => {
  const val = req.pathParam("0").string();
  res.send(`pathParam('0') = ${val}`);
});

// Two wildcards — exactly two segments
// Try:  curl http://localhost:3005/get/hello/world
//       → "0=hello  1=world"
router.get("/get/*/*", ({ req, res }) => {
  const a = req.pathParam("0").string();
  const b = req.pathParam("1").string();
  res.send(`0=${a}  1=${b}`);
});

// Double wildcard — zero or more segments
// Try:  curl http://localhost:3005/multi/a/b/c
//       → '["a","b","c"]'
// Try:  curl http://localhost:3005/multi
//       → "[]"
router.get("/multi/**", ({ req, res }) => {
  res.send(JSON.stringify(req.pathParams));
});

// ─── Path params with query params ────────────────────────────

// Try:  curl "http://localhost:3005/search?q=bun&limit=10"
//       → "queryParam('q') = bun  queryParam('limit') = 10"
router.get("/search", ({ req, res }) => {
  const q = req.queryParam("q");
  const limit = req.queryParam("limit");
  res.send(
    `queryParam('q') = ${q.string()}  queryParam('limit') = ${limit.string()}`,
  );
});

// Named path param + query params combined
// Try:  curl "http://localhost:3005/users/42/items?sort=asc&page=2"
//       → "user=42  sort=asc  page=2"
router.get("/users/:id/items", handlerName("getUserItems", ({ req, res }) => {
  const id = req.pathParam("id").string();
  const sort = req.queryParam("sort").string("desc"); // default: desc
  const page = req.queryParam("page").number(1);
  res.send(`user=${id}  sort=${sort}  page=${page}`);
}));

// ─── All params at once ───────────────────────────────────────

// Get all path params as a record
// Try:  curl "http://localhost:3005/books/42/chapters/7"
//       → '{"bookId":"42","chapterId":"7"}'
router.get("/books/:bookId/chapters/:chapterId", ({ req, res }) => {
  res.send(JSON.stringify(req.pathParam()));
});

// Get all query params as a record
// Try:  curl "curl http://localhost:3005/echo?name=alice&role=admin"
//       → '{"name":"alice","role":"admin"}'
router.get("/echo", ({ req, res }) => {
  res.send(JSON.stringify(req.queryParam()));
});

// ─── POST with params ─────────────────────────────────────────

// Try:  curl -X POST "http://localhost:3005/items/books/42?ref=home"
//       → "POST category=books id=42 ref=home"
router.post("/items/:category/:id", handlerName("createItem", ({ req, res }) => {
  const cat = req.pathParam("category").require();
  const id = req.pathParam("id").require();
  const ref = req.queryParam("ref").string("direct");
  res.send(`POST category=${cat} id=${id} ref=${ref}`);
}));

// ─── Delete with params ──────────────────────────────────────

// Try:  curl -X DELETE "http://localhost:3005/posts/99/comments/5?hard=true"
//       → "DELETE post=99 comment=5 hard=true"
router.delete("/posts/:postId/comments/:commentId", handlerName("deleteComment", ({ req, res }) => {
  const post = req.pathParam("postId").require();
  const comment = req.pathParam("commentId").require();
  const hard = req.queryParam("hard").boolean(false);
  res.send(`DELETE post=${post} comment=${comment} hard=${hard}`);
}));

export const server = Bun.serve({
  fetch: router.handle,
  port: 3005,
});

// Dump table
console.info(router.dump(server))

// Route definitions — JSON.stringify uses the built-in toJSON()
console.log("\nRoute definitions (Swagger-ready):")
console.log(JSON.stringify(router.getRouteDefinitions(), null, 2))
