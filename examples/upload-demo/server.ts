import { Router } from "src/index"
import type { Request } from "src/types"
import type { ResponseBuilder } from "src/index"
import { registerAuthRoutes } from "./lib/auth"
import { registerUploadRoutes } from "./lib/upload"
import { registerChatRoutes, getWebSocketHandlers } from "./lib/chat"
import type { ApiInfo } from "./lib/interfaces"

const router = new Router()

// Logging middleware
router.use("*", "/**", (req: Request, res: ResponseBuilder) => {
    const timestamp = new Date().toISOString()
    const method = req.httpMethod
    const url = new URL(req.url).pathname
    console.log(`[${timestamp}] --> ${method} ${url}`)

    // Log response using beforeSent hook
    res.beforeSent((res) => {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] <-- ${res.statusCode} ${method} ${url}`)
    })
})

// Register all routes
registerAuthRoutes(router)
registerUploadRoutes(router)
registerChatRoutes(router)

// Register WebSocket path and handlers
router.ws("/chat")
router.setWebSocketHandlers(getWebSocketHandlers())

// Serve static files
router.static("/css/**", import.meta.dir + "/css")
router.static("/html/**", import.meta.dir + "/html")

// Serve index page
router.get("/", (_: Request, res: ResponseBuilder) => {
    res.send(Bun.file(import.meta.dir + "/html/index.html"))
})

// Demo info route
router.get("/api/info", (_: Request, res: ResponseBuilder) => {
    const info: ApiInfo = {
        maxFileSize: "50 MB",
        uploadDir: "./uploads",
        endpoints: router.getRoutes(),
        websocket: "WS /chat"
    }
    res.setHeader("Content-Type", "application/json")
    res.send(JSON.stringify(info))
})

// Start server with WebSocket support
export const server = Bun.serve({
    fetch: router.handle,
    port: 3004,
    websocket: router.getWebSocketHandlers()!
})

console.info(router.dump(server))
