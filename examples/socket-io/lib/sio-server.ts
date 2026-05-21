import type { EndpointRoute, RequestMiddleware, WebSocketData } from "../../../src/types"
import { splitRoutePath } from "../../../src/path"
import { parseHttpMethods } from "../../../src/method"
import { RoomIndex } from "./room"
import { SioSocket } from "./socket"
import { Session } from "./session"
import { EIO, uid } from "./protocol"

export class SioServer {
  _roomIndex = new RoomIndex()
  _sessions = new Map<string, Session>()
  private _connHandlers: Set<(socket: SioSocket) => void> = new Set()
  private _emitHandlers: Map<string, Set<(...args: any[]) => void>> = new Map()
  path: string
  private _path: string
  ws: Bun.WebSocketHandler<WebSocketData>

  constructor(options: { path?: string } = {}) {
    this._path = options.path ?? "/socket.io"
    this.path = this._path
    this.ws = this._createWsHandler()
  }

  attach(routes: EndpointRoute[]): void {
    const socketPath = this._path
    const self = this

    const handler: RequestMiddleware = async (ctx) => {
      const req = ctx.req
      const url = new URL(req.url)
      if (!url.pathname.startsWith(socketPath)) return

      const transport = url.searchParams.get("transport")

      if (transport === "websocket") {
        const sid = url.searchParams.get("sid")
        const success = req.server.upgrade(req, { data: { __sessionId: sid } })
        if (success) req.upgraded = true
        return
      }

      const bodyText = await req.text().catch(() => "")
      await new Promise<void>((resolve) => {
        self.handleRequest(req.method, url, bodyText, (status, headers, body) => {
          ctx.res.statusCode = status
          for (const [k, v] of Object.entries(headers)) {
            ctx.res.setHeader(k, String(v), false)
          }
          ctx.res.bodyInit = body
          ctx.res.submit = true
          resolve()
        })
      })
    }

    routes.push({
      splitPath: splitRoutePath(socketPath + "/**"),
      method: parseHttpMethods("*"),
      handler,
      middlewareName: "socketio",
    })
  }

  private _createWsHandler(): Bun.WebSocketHandler<WebSocketData> {
    const self = this
    return {
      open(ws) {
        const data = ws.data as any
        const existingSid = data?.__sessionId

        if (existingSid && self._sessions.has(existingSid)) {
          self.registerWebSocket(existingSid, ws)
          return
        }

        const session = self._createSession()
        session.transport = "websocket"
        session.ws = ws
        data.__sessionId = session.id

        const handshake = JSON.stringify({
          sid: session.id,
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
          maxPayload: 1000000,
        })
        try { ws.send(`${EIO.OPEN}${handshake}`) } catch {}
      },
      message(ws, message) {
        const data = ws.data as any
        const text = typeof message === "string" ? message : new TextDecoder().decode(message)
        const sessionId = data?.__sessionId
        if (!sessionId) return
        const session = self._sessions.get(sessionId)
        if (session) self.handleWebSocketData(session, text)
      },
      close(ws) {
        const data = ws.data as any
        if (data?.__sessionId) {
          const session = self._sessions.get(data.__sessionId)
          if (session) session.close()
        }
      },
    }
  }

  _generateId(): string {
    return uid()
  }

  on(event: "connection", handler: (socket: SioSocket) => void): this
  on(event: string, handler: (...args: any[]) => void): this {
    if (event === "connection") {
      this._connHandlers.add(handler as any)
    } else {
      if (!this._emitHandlers.has(event)) this._emitHandlers.set(event, new Set())
      this._emitHandlers.get(event)!.add(handler)
    }
    return this
  }

  emit(event: string, ...args: any[]): this {
    const handlers = this._emitHandlers.get(event)
    if (handlers) {
      for (const h of handlers) h(...args)
    }
    for (const [, session] of this._sessions) {
      if (session.socket) {
        session.socket.emit(event, ...args)
      }
    }
    return this
  }

  to(room: string): { emit: (event: string, ...args: any[]) => void } {
    const sockets = this._roomIndex.get(room)
    return {
      emit: (event: string, ...args: any[]) => {
        for (const socket of sockets) {
          socket.emit(event, ...args)
        }
      },
    }
  }

  _sessionsDelete(id: string): void {
    this._sessions.delete(id)
  }

  _createSession(): Session {
    const session = new Session(this)
    this._sessions.set(session.id, session)
    return session
  }

  _createSocket(session: Session): SioSocket {
    const socket = new SioSocket(session, "/")
    session.socket = socket
    session.startPinging()
    for (const handler of this._connHandlers) {
      handler(socket)
    }
    return socket
  }

  handleRequest(
    method: string,
    url: URL,
    bodyText: string,
    sendResponse: (status: number, headers: Record<string, string>, body: string) => void,
  ): void {
    const search = url.searchParams
    const sid = search.get("sid")

    if (method === "GET") {
      if (sid) {
        const session = this._sessions.get(sid)
        if (!session || !session.connected) {
          sendResponse(400, { "Content-Type": "text/plain" }, "Session not found")
          return
        }
        session.poll().then((data) => {
          sendResponse(200, {
            "Content-Type": "text/plain; charset=UTF-8",
            "Cache-Control": "no-store",
          }, data)
        })
        return
      }

      const session = this._createSession()
      const handshake = JSON.stringify({
        sid: session.id,
        upgrades: ["websocket"],
        pingInterval: 25000,
        pingTimeout: 20000,
        maxPayload: 1000000,
      })
      sendResponse(200, {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "no-store",
      }, `${EIO.OPEN}${handshake}`)
      return
    }

    if (method === "POST") {
      if (!sid) {
        sendResponse(400, { "Content-Type": "text/plain" }, "Missing sid")
        return
      }
      const session = this._sessions.get(sid)
      if (!session || !session.connected) {
        sendResponse(400, { "Content-Type": "text/plain" }, "Session not found")
        return
      }

      const eioType = parseInt(bodyText[0], 10)
      const payload = bodyText.slice(1)

      if (eioType === EIO.PONG) {
        if (session.pingTimeoutTimer) clearTimeout(session.pingTimeoutTimer)
        sendResponse(200, { "Content-Type": "text/plain" }, "")
        return
      }

      if (eioType === EIO.MESSAGE) {
        if (!session.socket) this._createSocket(session)
        if (session.socket) (session.socket as SioSocket)._handleSioPacket(payload)
        sendResponse(200, { "Content-Type": "text/plain" }, "")
        return
      }

      sendResponse(200, { "Content-Type": "text/plain" }, "")
      return
    }

    sendResponse(405, { "Content-Type": "text/plain" }, "Method not allowed")
  }

  handleWebSocketData(session: Session, data: string): void {
    if (!session.connected) return

    const eioType = parseInt(data[0], 10)
    const payload = data.slice(1)

    if (eioType === EIO.PONG) {
      if (session.pingTimeoutTimer) clearTimeout(session.pingTimeoutTimer)
      return
    }

    if (eioType === EIO.MESSAGE) {
      if (!session.socket) this._createSocket(session)
      if (session.socket) (session.socket as SioSocket)._handleSioPacket(payload)
      return
    }
  }

  registerWebSocket(sessionId: string, ws: any): Session | null {
    const session = this._sessions.get(sessionId)
    if (!session || !session.connected) return null
    session.transport = "websocket"
    session.ws = ws
    return session
  }

  unregisterWebSocket(sessionId: string): void {
    const session = this._sessions.get(sessionId)
    if (session) {
      session.transport = "polling"
      session.ws = null
    }
  }
}
