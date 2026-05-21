import type { EndpointRoute } from "../../src/types"
import { SioServer } from "./lib/sio-server"

export { SioServer }

// ── Legacy API (still works, but prefer io.attach(routes) and io.ws) ──

export interface LegacyOptions {
  path?: string
  io?: SioServer
}

let _io: SioServer | null = null

export function getIO(): SioServer | null {
  return _io
}

export function socketioWebSocketHandler(): Bun.WebSocketHandler<any> {
  if (!_io) throw new Error("No SioServer instance. Call socketio() first.")
  return _io.ws
}

export function socketio(
  routes: EndpointRoute[],
  options: LegacyOptions = {},
): EndpointRoute[] {
  const socketPath = options.path ?? "/socket.io"

  if (options.io) {
    _io = options.io
  } else {
    const server = new SioServer({ path: socketPath })
    server.attach(routes)
    _io = server
  }

  return routes
}
