export interface User {
    username: string
    password: string
}

export interface Session {
    token: string
    username: string
    expiresAt: number
}

export interface FileInfo {
    name: string
    size: number
    uploadedAt: number
}

export interface ChatMessage {
    id: string
    username: string
    type: 'text' | 'image' | 'file'
    content: string
    filename?: string
    timestamp: number
}

export interface OnlineUser {
    username: string
    connectedAt: number
}

export interface ApiInfo {
    maxFileSize: string
    uploadDir: string
    endpoints?: Array<{ method: string; path: string }>
    globalEndpoints?: Array<{ method: string; path: string }>
    websocket: string
}
