# Building Real-Time Applications with bun-route

*Published May 2026*

Real-time features are no longer optional — users expect live updates, instant messaging, and collaborative experiences. In this article, we'll explore how to build real-time applications using bun-route's WebSocket support and the Socket.IO example, all powered by Bun's high-performance runtime.

## The Stack

- **Bun** — the JavaScript runtime, providing fast HTTP and WebSocket handling
- **bun-route** — routing and middleware for HTTP and WebSocket routes
- **socket.io-client** — the standard browser client (works with the Socket.IO example)

## Option 1: Native Bun WebSockets

For simple real-time features, Bun's native WebSocket API is all you need:

```ts
import { Router } from "bun-route";

const router = new Router();

router.get("/", ({ res }) => {
  res.file(Bun.file("./index.html"));
});

router.ws("/ws");

const connections = new Set<Bun.ServerWebSocket>();

Bun.serve({
  fetch: router.handle,
  websocket: {
    open(ws) {
      connections.add(ws);
      ws.subscribe("broadcast");
      ws.send(JSON.stringify({ type: "welcome", id: connections.size }));
    },
    message(ws, message) {
      ws.publish("broadcast", `${ws.remoteAddress}: ${message}`);
    },
    close(ws) {
      connections.delete(ws);
    },
  },
});
```

**When to use:** Simple broadcasting, notifications, or when you don't need rooms or event-based messaging.

## Option 2: Socket.IO Pattern

For more complex real-time applications — chat rooms, typing indicators, acknowledgements — a Socket.IO-compatible server can be built using bun-route's WebSocket support. The repository includes a complete example in [`examples/socket-io/`](../examples/socket-io/):

```ts
// Based on examples/socket-io/server.ts
import { Router } from "bun-route";
import { SioServer } from "./examples/socket-io/adapter";

const router = new Router();
const io = new SioServer({ path: "/socket.io" });
io.attach(router.routes);

io.on("connection", (socket) => {
  socket.on("chat:message", (text) => {
    io.emit("chat:message", { text, user: socket.data.username });
  });
});

Bun.serve({
  fetch: router.handle,
  websocket: io.ws,
});
```

**When to use:** Multiple event types, rooms, broadcasting with sender exclusion, ack callbacks, or when you need socket.io-client compatibility.

## Building a Chat Application with Native WebSockets

Let's build a chat app using bun-route's built-in WebSocket support.

### Step 1: Project Setup

```sh
mkdir chat-app && cd chat-app
bun init -y
bun add bun-route
```

### Step 2: Server (`server.ts`)

```ts
import { Router } from "bun-route";

const router = new Router();
const rooms = new Map<string, Set<string>>();

router.ws("/ws");

router.get("/api/rooms", ({ res }) => {
  const result: Record<string, number> = {};
  for (const [room, users] of rooms) result[room] = users.size;
  res.json(result);
});

router.static("/**", "./public");

Bun.serve({
  fetch: router.handle,
  websocket: {
    open(ws) {
      ws.data = { username: "", room: "" };
    },
    message(ws, raw) {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case "join":
            ws.data.username = msg.username;
            ws.data.room = msg.room;
            ws.subscribe(msg.room);
            if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
            rooms.get(msg.room)!.add(msg.username);
            ws.send(JSON.stringify({ type: "joined", room: msg.room }));
            ws.publish(msg.room, JSON.stringify({
              type: "user:joined",
              username: msg.username,
            }));
            break;

          case "message":
            ws.publish(ws.data.room, JSON.stringify({
              type: "message",
              username: ws.data.username,
              text: msg.text,
              timestamp: Date.now(),
            }));
            break;

          case "typing":
            ws.publishTo(ws.data.room, JSON.stringify({
              type: "typing",
              username: ws.data.username,
              isTyping: msg.isTyping,
            }));
            break;
        }
      } catch {}
    },
    close(ws) {
      const { username, room } = ws.data;
      if (room && username) {
        rooms.get(room)?.delete(username);
        ws.publish(room, JSON.stringify({
          type: "user:left",
          username,
        }));
      }
    },
  },
  port: 3000,
});
```

### Step 3: Client (`public/index.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Chat</title>
</head>
<body>
  <div id="messages"></div>
  <input id="msg" placeholder="Message" />
  <button onclick="send()">Send</button>

  <script>
    const ws = new WebSocket(`ws://${location.host}/ws`);
    const username = prompt("Username?") || "anon";

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", username, room: "general" }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const div = document.createElement("div");
      div.textContent = msg.type === "message"
        ? `${msg.username}: ${msg.text}`
        : `${msg.username} ${msg.type}`;
      document.getElementById("messages").appendChild(div);
    };

    function send() {
      const input = document.getElementById("msg");
      ws.send(JSON.stringify({ type: "message", text: input.value }));
      input.value = "";
    }
  </script>
</body>
</html>
```

### Step 4: Run

```sh
bun run server.ts
```

## The Socket.IO Example

For a more feature-rich real-time application, check out the [Socket.IO example](../examples/socket-io/) in the repository. It demonstrates:

- Rooms with join/leave notifications
- Online user tracking
- Chat history on connect
- Typing indicators
- Works with standard `socket.io-client` in the browser

Run it with:

```sh
cd examples/socket-io
bun install
bun run server.ts
```

## Performance Tips

1. **Use native WebSockets** for simple broadcast scenarios — lower overhead
2. **Use `ws.publish()` and `ws.subscribe()`** for efficient fan-out (Bun's built-in pub/sub)
3. **Batch messages** for high-throughput scenarios
4. **Clean up** disconnected clients — remove them from rooms and data stores
5. **Use JSON messages** with a `type` field for easy message routing

## Conclusion

bun-route's WebSocket support makes building real-time applications straightforward. For simple use cases, native WebSockets with Bun's pub/sub are fast and effective. For Socket.IO-compatible real-time features, the example in the repository provides a complete reference implementation.

---

*Try it yourself: `bun add bun-route` and check out the [examples](../examples/).*
