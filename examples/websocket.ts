import { Router } from "../src/index"

const router = new Router()

// handles GET requests to /
router.get("/", ({ req, res }) => {
    res.send("Root request")
})

// handels websocket requests on /ws
router.ws("/ws")

export const server = Bun.serve({
    fetch: router.handle,
    websocket: {
        open: (ws: Bun.ServerWebSocket<undefined>) => {
            console.log(ws.remoteAddress + " - incomming websocket connection")
        },
        message: (ws: Bun.ServerWebSocket<undefined>, msg: string | Buffer) => {
            console.log(ws.remoteAddress + " - message: " + msg)
        },
        close: (ws: Bun.ServerWebSocket<undefined>) => {
            console.log(ws.remoteAddress + " - websocket connection closed")
        }
    }
})

console.info(router.dump(server))