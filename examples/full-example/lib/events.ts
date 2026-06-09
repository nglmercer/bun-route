import { createSSEStream, handlerName } from "../../../src/index"
import type { Router } from "../../../src/index"

const sseClients = new Set<ReturnType<typeof createSSEStream>>()

export function registerEventRoutes(router: Router): void {
  router.get("/api/events", handlerName("sseEvents", ({ res }) => {
    const stream = createSSEStream(res)
    sseClients.add(stream)

    stream.sendEvent("connected", JSON.stringify({ message: "Connected to SSE" }))
    stream.sendComment("heartbeat")

    const interval = setInterval(() => {
      if (stream.isOpen()) {
        stream.sendEvent("heartbeat", JSON.stringify({ time: new Date().toISOString() }))
      } else {
        sseClients.delete(stream)
        clearInterval(interval)
      }
    }, 30_000)

    stream.send({ event: "init", data: JSON.stringify({ clients: sseClients.size }) })
  }))

  router.post("/api/events/broadcast", handlerName("broadcastEvent", ({ req, res }) => {
    const body = req.parsedBody as { event?: string; data?: string } | undefined
    const event = body?.event || "message"
    const data = body?.data || "Hello from broadcast"
    let sent = 0
    for (const client of sseClients) {
      if (client.isOpen()) {
        client.sendEvent(event, data)
        sent++
      }
    }
    res.json({ sent, clients: sseClients.size })
  }))
}
