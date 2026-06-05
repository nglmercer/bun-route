import { Router, type InferRoutes, type GetReturnType } from "../src/index"

const router = new Router()
    .get("/users", () => {
        return [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
        ]
    })
    .post("/users", (ctx) => {
        return { id: 3, name: "Charlie" }
    })
    .get("/users/:id", (ctx) => {
        return { id: 1, name: "Alice", email: "alice@example.com" }
    })

type AllRoutes = InferRoutes<typeof router>
type UsersResponse = GetReturnType<typeof router, "GET", "/users">
type CreateUserResponse = GetReturnType<typeof router, "POST", "/users">

export const server = Bun.serve({
    port: 3006,
    fetch: router.handle,
})

console.log("Server running on http://localhost:3006")
console.log("Routes:", router.getRoutes().map(r => `${r.method} ${r.path}`))
