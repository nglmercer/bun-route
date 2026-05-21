import type { SioServer } from "./sio-server"
import { EIO, DEFAULT_PING, encodeEio } from "./protocol"

type WsLike = { send(data: string): void; close(): void }

export interface SocketHandle {
  _triggerEvent(event: string, ...args: any[]): void
  emit(event: string, ...args: any[]): void
  rooms: Set<string>
}

export class Session {
  id: string
  transport: "polling" | "websocket" = "polling"
  socket: SocketHandle | null = null
  ws: WsLike | null = null
  sendQueue: string[] = []
  pollResolve: ((data: string) => void) | null = null
  pingTimer: Timer | null = null
  pingTimeoutTimer: Timer | null = null
  connected = true

  constructor(readonly server: SioServer) {
    this.id = server._generateId()
  }

  send(eioType: number, payload: string): void {
    if (!this.connected) return
    const data = encodeEio(eioType, payload)

    if (this.transport === "websocket" && this.ws) {
      try { this.ws.send(data) } catch { /* ignore */ }
      return
    }
    this.sendQueue.push(data)
    if (this.pollResolve) {
      this.pollResolve(this.sendQueue.shift()!)
    }
  }

  sendRaw(data: string): void {
    if (!this.connected) return
    if (this.transport === "websocket" && this.ws) {
      try { this.ws.send(data) } catch { /* ignore */ }
      return
    }
    this.sendQueue.push(data)
    if (this.pollResolve) {
      this.pollResolve(this.sendQueue.shift()!)
    }
  }

  poll(): Promise<string> {
    if (this.sendQueue.length > 0) {
      return Promise.resolve(this.sendQueue.shift()!)
    }
    return new Promise((resolve) => {
      this.pollResolve = resolve
    })
  }

  close(): void {
    if (!this.connected) return
    this.connected = false
    if (this.pingTimer) clearTimeout(this.pingTimer)
    if (this.pingTimeoutTimer) clearTimeout(this.pingTimeoutTimer)
    if (this.ws) { try { this.ws.close() } catch {} }
    if (this.socket) {
      this.socket.rooms.forEach((r) => this.server._roomIndex.remove(r, this.socket!))
      this.socket._triggerEvent("disconnect", "transport close")
    }
    this.server._sessionsDelete(this.id)
    if (this.pollResolve) {
      this.pollResolve(encodeEio(EIO.CLOSE, ""))
      this.pollResolve = null
    }
  }

  startPinging(): void {
    const schedulePing = () => {
      if (!this.connected) return
      this.sendRaw(encodeEio(EIO.PING, ""))
      this.pingTimeoutTimer = setTimeout(() => this.close(), DEFAULT_PING.timeout)
    }
    schedulePing()
    this.pingTimer = setInterval(schedulePing, DEFAULT_PING.interval)
  }
}
