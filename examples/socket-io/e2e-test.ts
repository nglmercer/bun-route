import { io as Client } from "socket.io-client"
import { Router } from "../../src/index"
import { SioServer } from "./adapter"

const PORT = 3006

async function main() {
  const router = new Router()
  const sio = new SioServer({ path: "/socket.io" })
  sio.attach(router.routes)

  sio.on("connection", (socket) => {
    console.log(`[server] client connected: ${socket.id}`)

    socket.on("test:ping", (data: any, cb?: Function) => {
      console.log(`[server] received ping:`, data)
      if (cb) cb({ pong: true, echo: data })
    })

    socket.on("chat:message", (text: string) => {
      console.log(`[server] chat message: ${text}`)
      socket.emit("chat:response", `echo: ${text}`)
    })
  })

  const server = Bun.serve({
    fetch: router.handle,
    port: PORT,
    websocket: sio.ws,
  })

  console.log(`Server on :${PORT}`)

  await new Promise((r) => setTimeout(r, 500))

  const client = Client(`http://localhost:${PORT}`, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    forceNew: true,
  })

  const results: string[] = []

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("connection timeout")), 5000)

    client.on("connect", () => {
      clearTimeout(timeout)
      console.log(`[client] connected: ${client.id}`)
      results.push("connected")

      client.emit("test:ping", { msg: "hello" }, (response: any) => {
        console.log(`[client] ping response:`, JSON.stringify(response))
        results.push(`pong:${response.pong}`)
        client.emit("chat:message", "Hello World!")
      })

      client.on("chat:response", (data: string) => {
        console.log(`[client] echo: ${data}`)
        results.push(`echo:${data}`)
        client.disconnect()
      })
    })

    client.on("disconnect", () => {
      clearTimeout(timeout)
      console.log("[client] disconnected")
      results.push("disconnected")
      resolve()
    })

    client.on("connect_error", (err: any) => {
      clearTimeout(timeout)
      console.log("[client] connect_error:", err.message)
      reject(err)
    })
  })

  server.stop()
  client.close()

  const expected = ["connected", "pong:true", "echo:echo: Hello World!", "disconnected"]
  let passed = true
  for (const exp of expected) {
    if (!results.includes(exp)) {
      console.error(`FAIL: expected "${exp}" not found in results`)
      passed = false
    }
  }

  if (passed) {
    console.log("\n✓ All e2e tests passed!")
    process.exit(0)
  } else {
    console.log("\n✗ Some tests failed. Results:", results)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("e2e failed:", err)
  process.exit(1)
})
