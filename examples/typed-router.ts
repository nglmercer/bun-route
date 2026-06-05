import { TypedRouter, type InferRoutes, type GetReturnType } from "../src/typedRouter"

const router = new TypedRouter()

const routerWithUsers = router.get("/users", () => {
    return [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
    ]
})

const routerWithCreateUser = routerWithUsers.post("/users", (ctx) => {
    return { id: 3, name: "Charlie" }
})

const routerWithGetUser = routerWithCreateUser.get("/users/:id", (ctx) => {
    return { id: 1, name: "Alice", email: "alice@example.com" }
})

type AllRoutes = InferRoutes<typeof routerWithGetUser>
type UsersResponse = GetReturnType<typeof routerWithGetUser, "GET", "/users">
type CreateUserResponse = GetReturnType<typeof routerWithGetUser, "POST", "/users">

export const server = Bun.serve({
    port: 3006,
    fetch: routerWithGetUser.handle,
})

console.log("Server running on http://localhost:3006")
console.log("Routes:", routerWithGetUser.getRoutes().map(r => `${r.method} ${r.path}`))
