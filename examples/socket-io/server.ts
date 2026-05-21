import { Router } from "../../src/index"
import { SioServer } from "./adapter"
import { readFileSync } from "fs"

const router = new Router()

const io = new SioServer({ path: "/socket.io" })
io.attach(router.routes)

const onlineUsers = new Map<string, string>()

io.on("connection", (socket) => {
  console.log(`[io] client connected: ${socket.id}`)

  socket.on("chat:join", (username: string) => {
    onlineUsers.set(socket.id, username)
    socket.data.username = username
    socket.join("general")
    io.to("general").emit("chat:system", {
      type: "join",
      username,
      online: countOnline(),
    })
    socket.emit("chat:history", [
      { username: "System", text: `Welcome, ${username}!`, timestamp: Date.now() },
    ])
  })

  socket.on("chat:message", (text: string) => {
    const username = socket.data.username ?? "Anonymous"
    io.to("general").emit("chat:message", {
      username,
      text,
      timestamp: Date.now(),
    })
  })

  socket.on("disconnect", () => {
    const username = onlineUsers.get(socket.id)
    onlineUsers.delete(socket.id)
    if (username) {
      io.to("general").emit("chat:system", {
        type: "leave",
        username,
        online: countOnline(),
      })
    }
  })

  socket.on("chat:typing", (isTyping: boolean) => {
    const username = socket.data.username ?? "Anonymous"
    socket.broadcast.to("general").emit("chat:typing", {
      username,
      isTyping,
    })
  })
})

function countOnline(): number {
  return onlineUsers.size
}

const html = readFileSync(import.meta.dir + "/index.html", "utf-8")
router.get("/", ({ res }) => { res.html(html) })

router.get("/api/status", ({ res }) => {
  res.json({
    online: countOnline(),
    users: Array.from(onlineUsers.values()),
    socketPath: "/socket.io",
  })
})

const server = Bun.serve({
  fetch: router.handle,
  port: 3005,
  websocket: io.ws,
})

console.info(router.dump(server))
console.log(`Socket.IO chat running at http://localhost:3005`)
