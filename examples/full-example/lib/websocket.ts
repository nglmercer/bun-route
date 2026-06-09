import type { Router } from "../../../src/index"

export function registerWebSocket(router: Router): void {
  router.ws("/ws")
  router.setWebSocketHandlers({
    open(ws) {
      const data = ws.data as { channelId?: string }
      console.log(`WS open: ${data?.channelId}`)
      ws.send(JSON.stringify({ type: "connected", channelId: data?.channelId }))
    },
    message(ws, message) {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message)
      try {
        const parsed = JSON.parse(text)
        ws.send(JSON.stringify({ type: "echo", data: parsed }))
      } catch {
        ws.send(JSON.stringify({ type: "echo", data: text }))
      }
    },
    close() {
      console.log("WS closed")
    },
  })
}
