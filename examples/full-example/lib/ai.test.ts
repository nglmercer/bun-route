import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { server } from "../server";

const BASE_URL = `http://localhost:${server.port}`;

describe("AI Endpoints", () => {
  afterAll(() => {
    server.stop();
  });

  describe("GET /api/ai/config", () => {
    it("returns AI configuration", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/config`);
      const data = await res.json();

      console.log("\n=== AI Config ===");
      console.log(JSON.stringify(data, null, 2));

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("configured");
      expect(data).toHaveProperty("baseURL");
      expect(data).toHaveProperty("model");
    });
  });

  describe("GET /api/ai/test", () => {
    it("tests AI connection", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/test`);
      const data = await res.json();

      console.log("\n=== AI Test ===");
      console.log(JSON.stringify(data, null, 2));

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("ok");

      if (data.ok) {
        console.log("✓ AI Response:", data.response);
      } else {
        console.log("✗ AI Error:", data.error);
      }
    });
  });

  describe("POST /api/ai/ask", () => {
    it("returns error when no question", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("answers a question about the API", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "What does GET /api/users do?" }),
      });
      const data = await res.json();

      console.log("\n=== AI Ask ===");
      console.log(JSON.stringify(data, null, 2));

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("answer");
      console.log("Answer:", data.answer);
    });
  });

  describe("POST /api/ai/docs", () => {
    it("returns error when no path/method", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("generates documentation for an endpoint", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/api/users", method: "get" }),
      });
      const data = await res.json();

      console.log("\n=== AI Docs ===");
      console.log(JSON.stringify(data, null, 2));

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("documentation");
      console.log("Documentation:", data.documentation?.substring(0, 300));
    });
  });

  describe("POST /api/ai/curl", () => {
    it("returns error when no path/method", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/curl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("generates curl command for an endpoint", async () => {
      const res = await fetch(`${BASE_URL}/api/ai/curl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/api/users",
          method: "get",
          params: { page: "1", limit: "5" },
        }),
      });
      const data = await res.json();

      console.log("\n=== AI Curl ===");
      console.log(JSON.stringify(data, null, 2));

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("curl");
      console.log("Curl:", data.curl);
    });
  });
});
