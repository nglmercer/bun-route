import { describe, expect, it } from "bun:test"
import { TypedRouter, type InferRoutes, type GetReturnType } from "../typedRouter"

describe("TypedRouter", () => {
    it("registers routes and returns data", async () => {
        const router = new TypedRouter()
            .get("/users", () => [{ id: 1, name: "Alice" }])
            .post("/users", () => ({ id: 2, name: "Bob" }))

        const routes = router.getRoutes()
        expect(routes).toHaveLength(2)
        expect(routes[0].method).toBe("GET")
        expect(routes[0].path).toBe("/users")
        expect(routes[1].method).toBe("POST")
        expect(routes[1].path).toBe("/users")
    })

    it("handles requests correctly", async () => {
        const router = new TypedRouter()
            .get("/hello", () => ({ message: "Hello World" }))

        const server = Bun.serve({ port: 0, fetch: router.handle })
        const port = server.port

        const res = await fetch(`http://localhost:${port}/hello`)
        const data = await res.json()
        expect(data).toEqual({ message: "Hello World" })

        server.stop()
    })

    it("supports middleware", async () => {
        const logger: import("../types").RequestMiddleware = (ctx) => {
            console.log(`${ctx.req.method} ${ctx.req.url}`)
        }

        const router = new TypedRouter()
            .get("/test", () => ({ ok: true }), logger)

        const routes = router.getRoutes()
        expect(routes).toHaveLength(1)
    })

    it("type inference works", () => {
        const router = new TypedRouter()
            .get("/users", () => [{ id: 1, name: "Alice" }])
            .post("/users", () => ({ id: 2, name: "Bob" }))
            .get("/users/:id", () => ({ id: 1, name: "Alice", email: "alice@example.com" }))

        type Routes = InferRoutes<typeof router>
        type UsersList = GetReturnType<typeof router, "GET", "/users">
        type CreateUser = GetReturnType<typeof router, "POST", "/users">
        type GetUser = GetReturnType<typeof router, "GET", "/users/:id">

        // These are compile-time checks - if types are wrong, TypeScript will error
        const usersList: UsersList = [{ id: 1, name: "Alice" }]
        const createUser: CreateUser = { id: 2, name: "Bob" }
        const getUser: GetUser = { id: 1, name: "Alice", email: "test@example.com" }

        expect(usersList).toBeDefined()
        expect(createUser).toBeDefined()
        expect(getUser).toBeDefined()
    })

    it("chains multiple routes", () => {
        const router = new TypedRouter()
            .get("/a", () => "a")
            .get("/b", () => "b")
            .get("/c", () => "c")
            .post("/d", () => "d")
            .put("/e", () => "e")
            .delete("/f", () => "f")
            .patch("/g", () => "g")

        const routes = router.getRoutes()
        expect(routes).toHaveLength(7)
    })
})
