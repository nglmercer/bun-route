import { Router } from "src/index"
import type { Request } from "src/types"
import type { ResponseBuilder } from "src/index"
import { registerAuthRoutes } from "./lib/auth"
import { registerUploadRoutes } from "./lib/upload"
import { registerChatRoutes, getWebSocketHandlers } from "./lib/chat"
import type { ApiInfo } from "./lib/interfaces"

const router = new Router()

// Register all routes
registerAuthRoutes(router)
registerUploadRoutes(router)
registerChatRoutes(router)

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
        endpoints: {
            login: "POST /api/login",
            me: "GET /api/me",
            logout: "POST /api/logout",
            upload: "POST /api/upload",
            files: "GET /api/files",
            deleteFile: "DELETE /api/files/*",
            serveFile: "GET /uploads/*",
            chatMessages: "GET /api/chat/messages",
            chatOnline: "GET /api/chat/online"
        },
        websocket: "WS /chat"
    }
    res.setHeader("Content-Type", "application/json")
    res.send(JSON.stringify(info))
})

// Start server with WebSocket support
export const server = Bun.serve({
    fetch(req: Request, server: any) {
        const url = new URL(req.url || "", `http://${req.headers.get("host") || "localhost"}`)

        // Handle WebSocket upgrade for /chat path
        if (url.pathname === "/chat") {
            const upgraded = server.upgrade(req)
            if (upgraded) return
        }

        // Otherwise use the router
        return router.handle(req, server)
    },
    port: 3004,
    websocket: getWebSocketHandlers()
})

console.info(router.dump(server))
