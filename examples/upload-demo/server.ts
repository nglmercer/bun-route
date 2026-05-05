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
function requireAuth(req: Request, res: ResponseBuilder): boolean {
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
    return true
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
            serveFile: "GET /uploads/*"
        }
    }
    sendJson(res, info)
})

export const server = Bun.serve({
    fetch: router.handle,
    port: 3003,
})

console.info(router.dump(server))
