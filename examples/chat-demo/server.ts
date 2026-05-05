import { Router } from "src/index"
import type { Request } from "src/types"
import type { ResponseBuilder } from "src/index"
import { registerAuthRoutes } from "./lib/auth"
import { registerUploadRoutes, registerFileRoutes } from "./lib/upload"
import { registerChatRoutes, getWebSocketHandlers } from "./lib/chat"
import type { ApiInfo } from "./lib/interfaces"
import { sendJson } from "./lib/utils"
const router = new Router()

// Error handler — catches all unhandled errors
router.onError((err, req, res) => {
    console.error(`[ERROR] ${req.httpMethod} ${req.path}:`, err.message)
    return sendJson(res, {
        error: "Internal server error",
        message: err.message,
    }, 500)
})

// Request ID middleware — adds X-Request-Id header
router.requestId("*", "/**")

// CORS middleware — allows all origins for the demo
router.cors("*", "/**", {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    maxAge: 86400,
})

// Logging middleware — uses req.ip and req.path directly
router.use("*", "/**", (req: Request, res: ResponseBuilder) => {
    const timestamp = new Date().toISOString()
    const method = req.method
    const ip = req.ip

    console.log(`[${timestamp}] --> ${method} ${req.path} from ${ip}`)

    // Log response using beforeSent hook
    res.beforeSent((res) => {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] <-- ${res.statusCode} ${method} ${req.path} [${req.id}]`)
    })
})

// Register routes using group() for organization

registerFileRoutes(router);
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
router.group("/api", (_router) => {
    registerAuthRoutes(_router)
    registerUploadRoutes(_router)
    registerChatRoutes(_router)

    // Demo info route — uses req.query() for filtering
    _router.get("/info", (req: Request, res: ResponseBuilder) => {
        const info: ApiInfo = {
            maxFileSize: "50 MB",
            uploadDir: "./uploads",
            ///_router.getRoutes(), current router in group, whe user router is global router
            endpoints: _router.getRoutes(),
            globalEndpoints: router.getRoutes(),
            websocket: "WS /chat"
        }

        // Support filtering endpoints by method via query param
        const methodFilter = req.query("method") as string;
        if (methodFilter) {
            const filtered = info.endpoints.filter(
                (e) => e.method.toUpperCase() === methodFilter.toUpperCase()
            );
            return sendJson(res, { ...info, endpoints: filtered })
        }

        return sendJson(res, info)
    })
})

// Start server with WebSocket support
export const server = Bun.serve({
    fetch: router.handle,
    port: 3004,
    websocket: router.getWebSocketHandlers()!
})

console.info(router.dump(server))
