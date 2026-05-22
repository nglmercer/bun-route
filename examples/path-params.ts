import { Router } from "../src/index"

const router = new Router()

// ─── GET — retrieve params ────────────────────────────────────

// Single wildcard — matches exactly one segment
// Try: GET /get/hello        → {"0":"hello"}
// Try: GET /get              → 404
router.get("/get/*", ({ req, res }) => {
    res.send("GET one param: " + JSON.stringify(req.pathParams))
})

// Two wildcards — matches exactly two segments
// Try: GET /get/hello/world  → {"0":"hello","1":"world"}
// Try: GET /get/hello        → 404
router.get("/get/*/*", ({ req, res }) => {
    res.send("GET two params: " + JSON.stringify(req.pathParams))
})

// Double wildcard — matches zero or more segments
// Try: GET /multi/a/b/c      → ["a","b","c"]
// Try: GET /multi            → true
router.get("/multi/**", ({ req, res }) => {
    res.send("GET multi params: " + JSON.stringify(req.pathParams))
})

// ─── POST — create with named params ──────────────────────────

// All named params (no wildcard mixing)
// Try: POST /items/books/42  → {"category":"books","id":"42"}
router.post("/items/:category/:id", ({ req, res }) => {
    const category = req.pathParam("category").string()
    const id = req.pathParam("id").string()
    res.send(`POST category=${category} id=${id}`)
})

// ─── PUT — update (full replacement) ──────────────────────────

// Named params for resource path
// Try: PUT /users/42         → {"id":"42"}
router.put("/users/:id", ({ req, res }) => {
    const id = req.pathParam("id").require()
    res.send(`PUT user ${id}`)
})

// ─── PATCH — partial update ───────────────────────────────────

// Wildcard captures one segment
// Try: PATCH /users/42/email  → {"0":"email"}
router.patch("/users/*/*", ({ req, res }) => {
    const id = req.pathParam("0").string()
    const field = req.pathParam("1").string()
    res.send(`PATCH user ${id} field=${field}`)
})

// ─── DELETE — with path params ────────────────────────────────

// Named params with resource nesting
// Try: DELETE /posts/99/comments/5  → {"postId":"99","commentId":"5"}
router.delete("/posts/:postId/comments/:commentId", ({ req, res }) => {
    const postId = req.pathParam("postId").require()
    const commentId = req.pathParam("commentId").require()
    res.send(`DELETE post ${postId} comment ${commentId}`)
})

// ─── Mixed: minimum 2 fixed, unlimited trailing ───────────────

// At least two segments + any number after
// Try: GET /mixed/a/b/c/d     → {"0":"a","1":"b","2":"c","3":"d"}
// Try: GET /mixed/a/b         → {"0":"a","1":"b"}
// Try: GET /mixed/a           → 404
router.get("/mixed/*/*/**", ({ req, res }) => {
    res.send("GET mixed params: " + JSON.stringify(req.pathParams))
})

export const server = Bun.serve({
    fetch: router.handle,
    port: 3005,
})

console.info(router.dump(server))
