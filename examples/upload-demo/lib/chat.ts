import { Router } from "src/index";
import type { Request } from "src/types";
import type { ResponseBuilder } from "src/index";
import type { WebSocketData } from "src/types";
import type { ChatMessage } from "./interfaces";
import { sessions, chatMessages, onlineUsers, userSockets } from "./state";
import {
  generateMessageId,
  requireAuth,
  sendJson,
  getOnlineUsersList,
  broadcastToAll,
} from "./utils";

// Chat API routes
export function registerChatRoutes(router: Router): void {
  router.get("/api/chat/messages", (req: Request, res: ResponseBuilder) => {
    const username = requireAuth(req, res);
    if (!username) return;

    const url = new URL(
      req.url || "",
      `http://${req.headers.get("host") || "localhost"}`,
    );
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const before = url.searchParams.get("before");

    let messages = [...chatMessages];
    if (before) {
      const beforeTime = parseInt(before);
      messages = messages.filter((m) => m.timestamp < beforeTime);
    }

    messages = messages.slice(-limit);
    sendJson(res, messages);
  });

  router.get("/api/chat/online", (req: Request, res: ResponseBuilder) => {
    const username = requireAuth(req, res);
    if (!username) return;

    sendJson(res, getOnlineUsersList());
  });
}

// WebSocket handlers for Bun.serve
export function getWebSocketHandlers() {
  return {
    open(_ws: Bun.ServerWebSocket<WebSocketData>) {
      // WebSocket connection opened - wait for auth
    },
    async message(ws: Bun.ServerWebSocket<WebSocketData>, message: string | Buffer) {
      try {
        const messageStr = typeof message === "string" ? message : message.toString();
        const data = JSON.parse(messageStr);

        if (data.type === "auth") {
          // Authenticate WebSocket connection
          const token = data.token;
          const session = sessions.get(token);
          if (!session || session.expiresAt < Date.now()) {
            ws.send(
              JSON.stringify({ type: "error", message: "Invalid token" }),
            );
            ws.close();
            return;
          }

          // Register user
          const username = session.username;
          onlineUsers.set(ws, {
            username,
            connectedAt: Date.now(),
          });

          if (!userSockets.has(username)) {
            userSockets.set(username, new Set());
          }
          userSockets.get(username)!.add(ws);

          // Send auth success
          ws.send(
            JSON.stringify({
              type: "auth_success",
              username,
              onlineUsers: getOnlineUsersList(),
            }),
          );

          // Broadcast user joined
          broadcastToAll({
            type: "user_joined",
            username,
            onlineUsers: getOnlineUsersList(),
          });

          // Send recent messages
          const recentMessages = chatMessages.slice(-50);
          ws.send(
            JSON.stringify({
              type: "message_history",
              messages: recentMessages,
            }),
          );
        } else if (data.type === "chat") {
          // Handle chat message
          const user = onlineUsers.get(ws);
          if (!user) {
            ws.send(
              JSON.stringify({ type: "error", message: "Not authenticated" }),
            );
            return;
          }

          const chatMsg: ChatMessage = {
            id: generateMessageId(),
            username: user.username,
            type: "text",
            content: data.content,
            timestamp: Date.now(),
          };

          chatMessages.push(chatMsg);
          if (chatMessages.length > 500) {
            chatMessages.shift(); // Keep last 500 messages
          }

          broadcastToAll({
            type: "message",
            message: chatMsg,
          });
        } else if (data.type === "chat_image") {
          // Handle image message with file reference
          const user = onlineUsers.get(ws);
          if (!user) {
            ws.send(
              JSON.stringify({ type: "error", message: "Not authenticated" }),
            );
            return;
          }

          const chatMsg: ChatMessage = {
            id: generateMessageId(),
            username: user.username,
            type: "image",
            content: data.content,
            filename: data.filename,
            timestamp: Date.now(),
          };

          chatMessages.push(chatMsg);
          if (chatMessages.length > 500) {
            chatMessages.shift();
          }

          broadcastToAll({
            type: "message",
            message: chatMsg,
          });
        } else if (data.type === "chat_file") {
          // Handle file message
          const user = onlineUsers.get(ws);
          if (!user) {
            ws.send(
              JSON.stringify({ type: "error", message: "Not authenticated" }),
            );
            return;
          }

          const chatMsg: ChatMessage = {
            id: generateMessageId(),
            username: user.username,
            type: "file",
            content: data.content,
            filename: data.filename,
            timestamp: Date.now(),
          };

          chatMessages.push(chatMsg);
          if (chatMessages.length > 500) {
            chatMessages.shift();
          }

          broadcastToAll({
            type: "message",
            message: chatMsg,
          });
        }
      } catch (err) {
        ws.send(
          JSON.stringify({ type: "error", message: "Invalid message format" }),
        );
      }
    },
    close(ws: Bun.ServerWebSocket<WebSocketData>) {
      const user = onlineUsers.get(ws);
      if (user) {
        onlineUsers.delete(ws);
        const sockets = userSockets.get(user.username);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            userSockets.delete(user.username);
          }
        }

        // Broadcast user left
        broadcastToAll({
          type: "user_left",
          username: user.username,
          onlineUsers: getOnlineUsersList(),
        });
      }
    },
  };
}
