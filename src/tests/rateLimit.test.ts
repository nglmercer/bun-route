import { describe, expect, it, mock } from "bun:test";
import { rateLimit } from "../router/rateLimit";
import type { EndpointRoute } from "../types";
import { createMockReq, createMockRes } from "./utils";

describe("rateLimit middleware", () => {
  it("adds a rate limit route", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "GET", "/api", { max: 10, windowMs: 60000 });
    expect(routes.length).toBe(1);
    expect(routes[0].splitPath).toEqual(["api"]);
  });

  it("allows requests within limit", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", { max: 5, windowMs: 60000 });
    const res = createMockRes();
    const req = createMockReq({
      headers: new Headers({ "x-forwarded-for": "1.2.3.4" })
    });
    routes[0].handler(req, res);
    expect(res.submit).toBe(false);
  });

  it("sets rate limit headers", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", { max: 10, windowMs: 60000 });
    const res = createMockRes();
    const req = createMockReq({
      headers: new Headers({ "x-forwarded-for": "1.2.3.4" })
    });
    routes[0].handler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "9");
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RateLimit-Reset",
      expect.any(String)
    );
  });

  it("blocks requests exceeding limit", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", { max: 2, windowMs: 60000 });
    const req = createMockReq({
      headers: new Headers({ "x-forwarded-for": "1.2.3.4" })
    });

    // First request - ok
    const res1 = createMockRes();
    routes[0].handler(req, res1);
    expect(res1.submit).toBe(false);

    // Second request - ok
    const res2 = createMockRes();
    routes[0].handler(req, res2);
    expect(res2.submit).toBe(false);

    // Third request - blocked
    const res3 = createMockRes();
    res3.status = mock(function () { return res3; }) as any;
    res3.send = mock(function () { res3.submit = true; }) as any;
    routes[0].handler(req, res3);
    expect(res3.status).toHaveBeenCalledWith(429);
  });

  it("uses x-real-ip when no x-forwarded-for", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", { max: 1, windowMs: 60000 });
    const res = createMockRes();
    const req = createMockReq({
      headers: new Headers({ "x-real-ip": "5.6.7.8" })
    });
    routes[0].handler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "1");
  });

  it("custom key generator works", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", {
      max: 1,
      windowMs: 60000,
      keyGenerator: (req) => req.headers.get("x-api-key") || "default"
    });
    const res = createMockRes();
    const req = createMockReq({
      headers: new Headers({ "x-api-key": "mykey123" })
    });
    routes[0].handler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "1");
  });

  it("different keys have separate limits", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", {
      max: 1,
      windowMs: 60000,
      keyGenerator: (req) => req.headers.get("x-api-key") || "default"
    });

    // Key "a" - first request
    const res1 = createMockRes();
    const req1 = createMockReq({
      headers: new Headers({ "x-api-key": "a" })
    });
    routes[0].handler(req1, res1);

    // Key "b" - first request (different key, should be ok)
    const res2 = createMockRes();
    const req2 = createMockReq({
      headers: new Headers({ "x-api-key": "b" })
    });
    routes[0].handler(req2, res2);
    expect(res2.submit).toBe(false);
  });

  it("can disable headers", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", { max: 10, windowMs: 60000, headers: false });
    const res = createMockRes();
    const req = createMockReq({
      headers: new Headers({ "x-forwarded-for": "1.2.3.4" })
    });
    routes[0].handler(req, res);
    expect(res.setHeader).not.toHaveBeenCalledWith(
      "X-RateLimit-Limit",
      expect.anything()
    );
  });

  it("sets Retry-After header when blocked", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", { max: 1, windowMs: 60000 });
    const req = createMockReq({
      headers: new Headers({ "x-forwarded-for": "1.2.3.4" })
    });

    // First request
    const res1 = createMockRes();
    routes[0].handler(req, res1);

    // Second request - blocked
    const res2 = createMockRes();
    res2.status = mock(function () { return res2; }) as any;
    res2.send = mock(function () { res2.submit = true; }) as any;
    routes[0].handler(req, res2);
    expect(res2.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("custom message is sent on block", () => {
    const routes: EndpointRoute[] = [];
    rateLimit(routes, "*", "/api", { max: 1, windowMs: 60000, message: "Slow down!" });
    const req = createMockReq({
      headers: new Headers({ "x-forwarded-for": "1.2.3.4" })
    });

    // First request
    routes[0].handler(req, createMockRes());

    // Second request - blocked
    const res = createMockRes();
    res.status = mock(function () { return res; }) as any;
    res.send = mock(function () { res.submit = true; }) as any;
    routes[0].handler(req, res);
    expect(res.send).toHaveBeenCalledWith("Slow down!");
  });
});
