import type { ResponseBuilder } from "@/src/index"
import type { Request } from "@/src/types"
import { statSync, existsSync } from "fs"
import type { FileInfo, OnlineUser } from "./interfaces"
import { sessions, onlineUsers, userSockets, UPLOAD_DIR } from "./state"
import { join } from "path"

// Utility: Generate random token
export function generateToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

// Utility: Generate message ID
export function generateMessageId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

// Utility: Parse auth header
export function parseAuthHeader(req: Request): string | null {
    const auth = req.headers.get("Authorization")
    if (!auth) return null
    const match = auth.match(/^Bearer\s+(.+)$/i)
    return match ? match[1] : null
}

// Utility: Check if user is authenticated
export function requireAuth(req: Request, res: ResponseBuilder): string | false {
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
export function sendJson(res: ResponseBuilder, data: unknown, statusCode?: number): void {
    if (statusCode) {
        res.status(statusCode)
    }
    res.setHeader("Content-Type", "application/json")
    res.send(JSON.stringify(data))
}

// Utility: Get file info
export function getFileInfo(filename: string): FileInfo | null {
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
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

// WebSocket message handlers
export function broadcastToUser(username: string, message: unknown): void {
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

export function broadcastToAll(message: unknown): void {
    const data = JSON.stringify(message)
    onlineUsers.forEach((user, ws) => {
        try {
            ws.send(data)
        } catch (e) {
            // Ignore send errors
        }
    })
}

export function getOnlineUsersList(): OnlineUser[] {
    return Array.from(onlineUsers.values())
}
