import { Router } from "src/index";
import { sessions, users } from "./state";
import { generateToken, parseAuthHeader, sendJson } from "./utils";

// Auth routes
export function registerAuthRoutes(router: Router): void {
  router.post("/login", async ({ req, res }) => {
    try {
      const body = (await req.json()) as { username: string; password: string };
      const user = users.find(
        (u) => u.username === body.username && u.password === body.password,
      );

      if (!user) {
        res.status(401).send("Invalid credentials");
        return;
      }

      const token = generateToken();
      sessions.set(token, {
        token,
        username: user.username,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
      });

      sendJson(res, { token, username: user.username });
    } catch {
      res.status(400).send("Invalid request body");
    }
  });

  router.get("/me", ({ res, req }) => {
    const token = parseAuthHeader(req);
    if (!token) {
      res.status(401).send("Missing authorization token");
      return;
    }
    const session = sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      res.status(401).send("Invalid or expired token");
      return;
    }
    sendJson(res, { username: session.username });
  });

  router.post("/logout", ({ res, req }) => {
    const token = parseAuthHeader(req);
    if (token) sessions.delete(token);
    sendJson(res, { message: "Logged out" });
  });
}
