import { existsSync, mkdirSync } from "fs"
import { join } from "path"
import type { User, Session, ChatMessage, OnlineUser } from "./interfaces"

export const UPLOAD_DIR = join(import.meta.dir, "..", "uploads")
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true })
}

// In-memory auth storage (demo purposes)
export const users: User[] = [
    { username: "admin", password: "password123" },
    { username: "user", password: "test456" }
]

export const sessions: Map<string, Session> = new Map()

// WebSocket chat storage
export const chatMessages: ChatMessage[] = []
export const onlineUsers: Map<any, OnlineUser> = new Map()
export const userSockets: Map<string, Set<any>> = new Map()
