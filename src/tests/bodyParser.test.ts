import { describe, expect, it, mock } from "bun:test";
import { bodyParser } from "../router/bodyParser";
import { parseHttpMethods } from "../method";
import type { EndpointRoute } from "../types";
import { createMockReq, createMockRes } from "./utils";
import { Context } from "../context";

describe("bodyParser middleware", () => {
  it("adds a body parser route", () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api");
    expect(routes.length).toBe(1);
    expect(routes[0].splitPath).toEqual(["api"]);
  });

  it("parses JSON body", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api");
    const body = JSON.stringify({ name: "test", value: 42 });
    let selfRef: any;
    const localRes = createMockRes();
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      text: mock(async () => body),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const localCtx = new Context(req, localRes);
    await routes[0].handler(localCtx);
    expect(req.parsedBody).toEqual({ name: "test", value: 42 });
  });


  it("parses form-urlencoded body", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api");

    const body = "name=test&value=42";
    let selfRef: any;
    const localRes = createMockRes();
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "application/x-www-form-urlencoded" }),
      text: mock(async () => body),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const localCtx = new Context(req, localRes);
    await routes[0].handler(localCtx);
    expect(req.parsedBody).toEqual({ name: "test", value: "42" });
  });


  it("parses text body", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api");

    const body = "plain text content";
    let selfRef: any;
    const localRes = createMockRes();
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "text/plain" }),
      text: mock(async () => body),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const localCtx = new Context(req, localRes);
    await routes[0].handler(localCtx);
    expect(req.parsedBody).toBe("plain text content");
  });


  it("handles invalid JSON gracefully", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api");

    let selfRef: any;
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      text: mock(async () => "not json {{{"),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const ctx = new Context(req, createMockRes());
    await routes[0].handler(ctx);
    expect(req.parsedBody).toBeUndefined();
  });

  it("does not parse when json option is false", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api", { json: false, text: false, form: false });

    let selfRef: any;
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      text: mock(async () => '{"key":"value"}'),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const ctx = new Context(req, createMockRes());
    await routes[0].handler(ctx);
    expect(req.parsedBody).toBeUndefined();
  });

  it("does not parse when text option is false", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api", { text: false, json: false, form: false });

    let selfRef: any;
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "text/plain" }),
      text: mock(async () => "some text"),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const ctx = new Context(req, createMockRes());
    await routes[0].handler(ctx);
    expect(req.parsedBody).toBeUndefined();
  });

  it("does not parse when form option is false", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api", { form: false, json: false, text: false });

    let selfRef: any;
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "application/x-www-form-urlencoded" }),
      text: mock(async () => "key=value"),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const ctx = new Context(req, createMockRes());
    await routes[0].handler(ctx);
    expect(req.parsedBody).toBeUndefined();
  });

  it("respects limit option for JSON", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api", { limit: 5 });

    let selfRef: any;
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      text: mock(async () => '{"name":"long value that exceeds limit"}'),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const ctx = new Context(req, createMockRes());
    await routes[0].handler(ctx);
    // Truncated JSON should fail to parse
    expect(req.parsedBody).toBeUndefined();
  });

  it("respects limit option for text", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api", { limit: 5 });

    let selfRef: any;
    const localRes = createMockRes();
    const req = createMockReq({
      method: "POST",
      headers: new Headers({ "content-type": "text/plain" }),
      text: mock(async () => "hello world"),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const localCtx = new Context(req, localRes);
    await routes[0].handler(localCtx);
    expect(req.parsedBody).toBe("hello");
  });


  it("works with all methods", () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "*", "/api");
    expect(routes.length).toBe(1);
    expect(routes[0].method).toBe(parseHttpMethods("*"));
  });

  it("handles missing content-type as text", async () => {
    const routes: EndpointRoute[] = [];
    bodyParser(routes, "POST", "/api");

    let selfRef: any;
    const localRes = createMockRes();
    const req = createMockReq({
      method: "POST",
      headers: new Headers(),
      text: mock(async () => "fallback text"),
    });
    selfRef = req;
    (req as any).clone = mock(() => selfRef);
    const localCtx = new Context(req, localRes);
    await routes[0].handler(localCtx);
    expect(req.parsedBody).toBe("fallback text");
  });

});
