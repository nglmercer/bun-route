import { Router } from "../../src/index"
import type { Request } from "../../src/types"
import type { ResponseBuilder } from "../../src/index"
import { existsSync, mkdirSync, statSync, unlinkSync, readdirSync } from "fs"
import { join } from "path"

const router = new Router()
const UPLOAD_DIR = import.meta.dir + "/uploads"
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true })
}

// In-memory auth storage (demo purposes)
interface User {
    username: string
    password: string
}

interface Session {
    token: string
    username: string
    expiresAt: number
}

interface FileInfo {
    name: string
    size: number
    uploadedAt: number
}

const users: User[] = [
    { username: "admin", password: "password123" },
    { username: "user", password: "test456" }
]

const sessions: Map<string, Session> = new Map()

// WebSocket chat storage
interface ChatMessage {
    id: string
    username: string
    type: 'text' | 'image' | 'file'
    content: string
    filename?: string
    timestamp: number
}

interface OnlineUser {
    username: string
    connectedAt: number
}

const chatMessages: ChatMessage[] = []
const onlineUsers: Map<any, OnlineUser> = new Map()
const userSockets: Map<string, Set<any>> = new Map()

// Utility: Generate random token
function generateToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

// Utility: Parse auth header
function parseAuthHeader(req: Request): string | null {
    const auth = req.headers.get("Authorization")
    if (!auth) return null
    const match = auth.match(/^Bearer\s+(.+)$/i)
    return match ? match[1] : null
}

// Utility: Check if user is authenticated
function requireAuth(req: Request, res: ResponseBuilder): boolean | string {
    const token = parseAuthHeader(req)
    if (!token) {
        res.status(401).send("Missing authorization token")
        return false
    }
    const session = sessions.get(token)
    if (!session || session.expiresAt < Date.now()) {
        sessions.delete(token)
        res.status(401).send("Invalid or expired token")
        return false
    }
    return session.username
}

// Utility: Send JSON response
function sendJson(res: ResponseBuilder, data: unknown, statusCode?: number): void {
    if (statusCode) {
        res.status(statusCode)
    }
    res.setHeader("Content-Type", "application/json")
    res.send(JSON.stringify(data))
}

// Utility: Get file info
function getFileInfo(filename: string): FileInfo | null {
    const filepath = join(UPLOAD_DIR, filename)
    if (!existsSync(filepath)) return null
    const stat = statSync(filepath)
    return {
        name: filename,
        size: stat.size,
        uploadedAt: stat.mtimeMs
    }
}

// Utility: Format file size
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

// Utility: Generate message ID
function generateMessageId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

// WebSocket message handler
function broadcastToUser(username: string, message: unknown): void {
    const sockets = userSockets.get(username)
    if (sockets) {
        const data = JSON.stringify(message)
        sockets.forEach(ws => {
            try {
                ws.send(data)
            } catch (e) {
                // Ignore send errors
            }
        })
    }
}

function broadcastToAll(message: unknown): void {
    const data = JSON.stringify(message)
    onlineUsers.forEach((user, ws) => {
        try {
            ws.send(data)
        } catch (e) {
            // Ignore send errors
        }
    })
}

function getOnlineUsersList(): OnlineUser[] {
    return Array.from(onlineUsers.values())
}

// Auth routes
router.post("/api/login", async (req: Request, res: ResponseBuilder) => {
    try {
        const body = await req.json() as { username: string; password: string }
        const user = users.find(u => u.username === body.username && u.password === body.password)

        if (!user) {
            res.status(401).send("Invalid credentials")
            return
        }

        const token = generateToken()
        sessions.set(token, {
            token,
            username: user.username,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24h
        })

        sendJson(res, { token, username: user.username })
    } catch {
        res.status(400).send("Invalid request body")
    }
})

// Chat API routes
router.get("/api/chat/messages", (req: Request, res: ResponseBuilder) => {
    const username = requireAuth(req, res)
    if (!username) return

    const url = new URL(req.url || "", `http://${req.headers.get("host") || "localhost"}`)
    const limit = parseInt(url.searchParams.get("limit") || "50")
    const before = url.searchParams.get("before")

    let messages = [...chatMessages]
    if (before) {
        const beforeTime = parseInt(before)
        messages = messages.filter(m => m.timestamp < beforeTime)
    }

    messages = messages.slice(-limit)
    sendJson(res, messages)
})

router.get("/api/chat/online", (req: Request, res: ResponseBuilder) => {
    const username = requireAuth(req, res)
    if (!username) return

    sendJson(res, getOnlineUsersList())
})

router.get("/api/me", (req: Request, res: ResponseBuilder) => {
    const token = parseAuthHeader(req)
    if (!token) {
        res.status(401).send("Missing authorization token")
        return
    }
    const session = sessions.get(token)
    if (!session || session.expiresAt < Date.now()) {
        res.status(401).send("Invalid or expired token")
        return
    }
    sendJson(res, { username: session.username })
})

router.post("/api/logout", (req: Request, res: ResponseBuilder) => {
    const token = parseAuthHeader(req)
    if (token) sessions.delete(token)
    sendJson(res, { message: "Logged out" })
})

// Upload route with size limit
router.post("/api/upload", async (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return

    // Check content length
    const contentLength = parseInt(req.headers.get("content-length") || "0")
    if (contentLength > MAX_FILE_SIZE) {
        res.status(413).send(`File too large. Max size: ${formatFileSize(MAX_FILE_SIZE)}`)
        return
    }

    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            res.status(400).send("No file provided")
            return
        }

        if (file.size > MAX_FILE_SIZE) {
            res.status(413).send(`File too large. Max size: ${formatFileSize(MAX_FILE_SIZE)}`)
            return
        }

        // Sanitize filename
        const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filepath = join(UPLOAD_DIR, filename)

        // Write file
        const arrayBuffer = await file.arrayBuffer()
        await Bun.write(filepath, arrayBuffer)

        sendJson(res, {
            message: "File uploaded successfully",
            file: getFileInfo(filename)
        })
    } catch (err: unknown) {
        res.status(500).send("Upload failed: " + (err instanceof Error ? err.message : String(err)))
    }
})

// List uploaded files
router.get("/api/files", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return

    try {
        const files = readdirSync(UPLOAD_DIR)
            .map(name => getFileInfo(name))
            .filter((f): f is FileInfo => f !== null)
            .sort((a, b) => b.uploadedAt - a.uploadedAt)

        sendJson(res, files)
    } catch {
        sendJson(res, [])
    }
})

// Delete file
router.delete("/api/files/*", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return

    const filename = req.pathParams?.[0] || ""
    const filepath = join(UPLOAD_DIR, filename)

    if (!existsSync(filepath)) {
        res.status(404).send("File not found")
        return
    }

    try {
        unlinkSync(filepath)
        sendJson(res, { message: "File deleted" })
    } catch {
        res.status(500).send("Failed to delete file")
    }
})

// Serve uploaded files (protected)
router.get("/uploads/*", (req: Request, res: ResponseBuilder) => {
    if (!requireAuth(req, res)) return

    const filename = req.path.replace("/uploads/", "")
    const filepath = join(UPLOAD_DIR, filename)

    if (!existsSync(filepath)) {
        res.status(404).send("File not found")
        return
    }

    res.send(Bun.file(filepath))
})

// Serve static files
router.static("/css/**", import.meta.dir + "/css")
router.static("/html/**", import.meta.dir + "/html")

// Serve index page
router.get("/", (_, res: ResponseBuilder) => {
    res.send(Bun.file(import.meta.dir + "/html/index.html"))
})

// Demo info route
interface ApiInfo {
    maxFileSize: string
    uploadDir: string
    endpoints: Record<string, string>
    websocket: string
}

router.get("/api/info", (_: Request, res: ResponseBuilder) => {
    const info: ApiInfo = {
        maxFileSize: formatFileSize(MAX_FILE_SIZE),
        uploadDir: UPLOAD_DIR,
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
    sendJson(res, info)
})

export const server = Bun.serve({
    fetch(req: Request, server) {
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
    websocket: {
        open(ws) {
            // WebSocket connection opened - wait for auth
        },
        async message(ws, message) {
            try {
                const data = JSON.parse(message as string)

                if (data.type === 'auth') {
                    // Authenticate WebSocket connection
                    const token = data.token
                    const session = sessions.get(token)
                    if (!session || session.expiresAt < Date.now()) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }))
                        ws.close()
                        return
                    }

                    // Register user
                    const username = session.username
                    onlineUsers.set(ws, {
                        username,
                        connectedAt: Date.now()
                    })

                    if (!userSockets.has(username)) {
                        userSockets.set(username, new Set())
                    }
                    userSockets.get(username)!.add(ws)

                    // Send auth success
                    ws.send(JSON.stringify({
                        type: 'auth_success',
                        username,
                        onlineUsers: getOnlineUsersList()
                    }))

                    // Broadcast user joined
                    broadcastToAll({
                        type: 'user_joined',
                        username,
                        onlineUsers: getOnlineUsersList()
                    })

                    // Send recent messages
                    const recentMessages = chatMessages.slice(-50)
                    ws.send(JSON.stringify({
                        type: 'message_history',
                        messages: recentMessages
                    }))

                } else if (data.type === 'chat') {
                    // Handle chat message
                    const user = onlineUsers.get(ws)
                    if (!user) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
                        return
                    }

                    const chatMsg: ChatMessage = {
                        id: generateMessageId(),
                        username: user.username,
                        type: 'text',
                        content: data.content,
                        timestamp: Date.now()
                    }

                    chatMessages.push(chatMsg)
                    if (chatMessages.length > 500) {
                        chatMessages.shift() // Keep last 500 messages
                    }

                    broadcastToAll({
                        type: 'message',
                        message: chatMsg
                    })

                } else if (data.type === 'chat_image') {
                    // Handle image message with file reference
                    const user = onlineUsers.get(ws)
                    if (!user) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
                        return
                    }

                    const chatMsg: ChatMessage = {
                        id: generateMessageId(),
                        username: user.username,
                        type: 'image',
                        content: data.content,
                        filename: data.filename,
                        timestamp: Date.now()
                    }

                    chatMessages.push(chatMsg)
                    if (chatMessages.length > 500) {
                        chatMessages.shift()
                    }

                    broadcastToAll({
                        type: 'message',
                        message: chatMsg
                    })

                } else if (data.type === 'chat_file') {
                    // Handle file message
                    const user = onlineUsers.get(ws)
                    if (!user) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
                        return
                    }

                    const chatMsg: ChatMessage = {
                        id: generateMessageId(),
                        username: user.username,
                        type: 'file',
                        content: data.content,
                        filename: data.filename,
                        timestamp: Date.now()
                    }

                    chatMessages.push(chatMsg)
                    if (chatMessages.length > 500) {
                        chatMessages.shift()
                    }

                    broadcastToAll({
                        type: 'message',
                        message: chatMsg
                    })
                }
            } catch (err) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
            }
        },
        close(ws) {
            const user = onlineUsers.get(ws)
            if (user) {
                onlineUsers.delete(ws)
                const sockets = userSockets.get(user.username)
                if (sockets) {
                    sockets.delete(ws)
                    if (sockets.size === 0) {
                        userSockets.delete(user.username)
                    }
                }

                // Broadcast user left
                broadcastToAll({
                    type: 'user_left',
                    username: user.username,
                    onlineUsers: getOnlineUsersList()
                })
            }
        }
    }
})

console.info(router.dump(server))
