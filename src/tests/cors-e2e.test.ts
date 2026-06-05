import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Router } from "..";

describe("CORS e2e - POST/GET with cors middleware", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeAll(() => {
    const router = new Router();

    router.cors("*", "/api/v1/auth/**", {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 3600,
    });

    router.post("/api/v1/auth/register", async ({ req, res }) => {
      const body = await req.json();
      res.json({ success: true, user: body });
    });

    router.get("/api/v1/auth/profile", ({ res }) => {
      res.json({ id: 1, name: "test" });
    });

    server = Bun.serve({
      port: 0,
      fetch: router.handle,
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("POST response includes Access-Control-Allow-Origin (reflected origin with credentials)", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:5173",
      },
      body: JSON.stringify({ email: "test@test.com", password: "123" }),
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("GET response includes Access-Control-Allow-Origin (reflected origin with credentials)", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/profile`, {
      headers: { "Origin": "http://localhost:5173" },
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("OPTIONS preflight reflects origin when credentials: true", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(resp.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(resp.headers.get("Access-Control-Max-Age")).toBe("3600");
  });
});

describe("CORS e2e - specific origin array", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeAll(() => {
    const router = new Router();

    router.cors("*", "/api/v1/auth/**", {
      origin: ["http://localhost:5173", "http://localhost:3000"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    });

    router.post("/api/v1/auth/register", ({ res }) => {
      res.json({ success: true });
    });

    server = Bun.serve({
      port: 0,
      fetch: router.handle,
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("POST from allowed origin gets CORS headers", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:5173",
      },
      body: JSON.stringify({ email: "a@b.com" }),
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("OPTIONS preflight from allowed origin works", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });

    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(resp.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(resp.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("disallowed origin gets no CORS headers", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://evil.com",
      },
      body: JSON.stringify({ email: "a@b.com" }),
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("disallowed origin preflight gets no CORS headers", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("CORS e2e - wrong method registration (GET only)", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeAll(() => {
    const router = new Router();

    router.cors("GET", "/api/v1/auth/**", {
      origin: "http://allowed.com",
    });

    router.post("/api/v1/auth/register", ({ res }) => {
      res.json({ success: true });
    });

    server = Bun.serve({
      port: 0,
      fetch: router.handle,
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("POST has no CORS headers when middleware only registered for GET", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:5173",
      },
      body: JSON.stringify({ email: "test@test.com" }),
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS preflight not handled when only GET is registered", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://allowed.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("CORS e2e - no CORS middleware at all", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeAll(() => {
    const router = new Router();

    router.post("/api/v1/auth/register", ({ res }) => {
      res.json({ success: true });
    });

    server = Bun.serve({
      port: 0,
      fetch: router.handle,
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("no CORS headers when middleware is not registered", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:5173",
      },
      body: JSON.stringify({ email: "a@b.com" }),
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS returns 404 when no CORS middleware handles it", async () => {
    const resp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("CORS e2e - headers preserved across sendText, sendHtml, sendError", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeAll(() => {
    const router = new Router();

    router.cors("*", "/api/**", { origin: "*" });

    router.get("/api/text", ({ res }) => {
      res.text("hello");
    });

    router.get("/api/html", ({ res }) => {
      res.html("<h1>hello</h1>");
    });

    router.get("/api/error", ({ res }) => {
      res.error("bad", 400);
    });

    router.get("/api/no-content", ({ res }) => {
      res.noContent();
    });

    server = Bun.serve({
      port: 0,
      fetch: router.handle,
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("res.text() preserves CORS headers", async () => {
    const resp = await fetch(`${baseUrl}/api/text`, {
      headers: { "Origin": "http://example.com" },
    });
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("res.html() preserves CORS headers", async () => {
    const resp = await fetch(`${baseUrl}/api/html`, {
      headers: { "Origin": "http://example.com" },
    });
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("res.error() preserves CORS headers", async () => {
    const resp = await fetch(`${baseUrl}/api/error`, {
      headers: { "Origin": "http://example.com" },
    });
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("res.noContent() preserves CORS headers", async () => {
    const resp = await fetch(`${baseUrl}/api/no-content`, {
      headers: { "Origin": "http://example.com" },
    });
    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});