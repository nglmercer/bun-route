import { describe, expect, it, mock } from "bun:test";
import { ws, redirect, staticFiles, basicAuth, cookies } from "../router/builtin";
import { parseHttpMethods } from "../method";
import type { EndpointRoute } from "../types";
import { createMockReq, createMockRes } from "./utils";
describe("builtin.ws", () => {
  it("adds a websocket route with GET method", () => {
    const routes: EndpointRoute[] = [];
    ws(routes, "/ws");
    expect(routes.length).toBe(1);
    expect(routes[0].method).toEqual(parseHttpMethods("GET"));
    expect(routes[0].splitPath).toEqual(["ws"]);
  });

  it("sets req.upgraded on successful upgrade", () => {
    const routes: EndpointRoute[] = [];
    ws(routes, "/ws");
    const upgradeMock = mock(() => true);
    const req = createMockReq({
      server: { upgrade: upgradeMock },
      upgraded: false as true
    });
    const res = createMockRes();
    routes[0].handler(req, res);
    expect(req.upgraded).toBe(true);
    expect(upgradeMock).toHaveBeenCalled();
  });
});

describe("builtin.redirect", () => {
  it("adds a redirect route with correct method", () => {
    const routes: EndpointRoute[] = [];
    redirect(routes, "GET", "/old", "/new");
    expect(routes.length).toBe(1);
    expect(routes[0].method).toEqual(parseHttpMethods("GET"));
    expect(routes[0].splitPath).toEqual(["old"]);
  });

  it("uses 302 by default", () => {
    const routes: EndpointRoute[] = [];
    redirect(routes, "GET", "/old", "/new");
    const res = createMockRes();
    res.sendRedirect = mock((target: string, perma: boolean) => {
      expect(target).toBe("/new");
      expect(perma).toBe(false);
    });
    const req = createMockReq();
    routes[0].handler(req, res);
    expect(res.sendRedirect).toHaveBeenCalled();
  });

  it("uses 301 when perma is true", () => {
    const routes: EndpointRoute[] = [];
    redirect(routes, "GET", "/old", "/new", true);
    const res = createMockRes();
    res.sendRedirect = mock((target: string, perma: boolean) => {
      expect(perma).toBe(true);
    });
    const req = createMockReq();
    routes[0].handler(req, res);
    expect(res.sendRedirect).toHaveBeenCalled();
  });
});

describe("builtin.basicAuth", () => {
  it("adds a basic auth route", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", (u, p) => u === "user" && p === "pass");
    expect(routes.length).toBe(1);
    expect(routes[0].splitPath).toEqual(["protected"]);
  });

  it("sends basic auth header when no auth header", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", () => true);
    const res = createMockRes();
    res.sendBasicAuth = mock(() => { });
    const req = createMockReq();
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).toHaveBeenCalled();
  });

  it("validates credentials correctly", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", (u, p) => u === "admin" && p === "secret");
    const res = createMockRes();
    res.sendBasicAuth = mock(() => { });
    const authValue = btoa("admin:secret");
    const req = createMockReq({ headers: new Headers({ authorization: `Basic ${authValue}` }) });
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).not.toHaveBeenCalled();
  });

  it("sends auth header on invalid credentials", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", () => false);
    const res = createMockRes();
    res.sendBasicAuth = mock(() => { });
    const authValue = btoa("user:wrong");
    const req = createMockReq({ headers: new Headers({ authorization: `Basic ${authValue}` }) });
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).toHaveBeenCalled();
  });

  it("sends auth header on unprocessable header (no space)", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", () => true);
    const res = createMockRes();
    res.sendBasicAuth = mock(() => { });
    const req = createMockReq({ headers: new Headers({ authorization: "Basic" }) });
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).toHaveBeenCalledWith("Unprocessable authorization header", expect.anything(), expect.anything());
  });

  it("sends auth header on wrong schema", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", () => true);
    const res = createMockRes();
    res.sendBasicAuth = mock(() => { });
    const req = createMockReq({ headers: new Headers({ authorization: "Bearer token" }) });
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).toHaveBeenCalledWith("Unprocessable basic auth schema", expect.anything(), expect.anything());
  });

  it("sends auth header on missing colon in credentials", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", () => true);
    const res = createMockRes();
    res.sendBasicAuth = mock(() => { });
    const authValue = btoa("nocolonhere");
    const req = createMockReq({ headers: new Headers({ authorization: `Basic ${authValue}` }) });
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).toHaveBeenCalledWith("Unprocessable basic auth credentials", expect.anything(), expect.anything());
  });
});

describe("builtin.cookies", () => {
  it("adds a cookie parsing route", () => {
    const routes: EndpointRoute[] = [];
    cookies(routes, "GET", "/cookies");
    expect(routes.length).toBe(1);
    expect(routes[0].splitPath).toEqual(["cookies"]);
  });

  it("parses cookies when middleware runs", () => {
    const routes: EndpointRoute[] = [];
    cookies(routes, "GET", "/cookies");
    const req = createMockReq({ headers: new Headers({ cookie: "a=1" }) });
    routes[0].handler(req, createMockRes());
    expect(req.cookies).toEqual({ a: "1" });
  });

  it("autoResponseHeaders sets beforeSent hook", () => {
    const routes: EndpointRoute[] = [];
    cookies(routes, "GET", "/cookies", true);
    const req = createMockReq({ headers: new Headers({ cookie: "a=1" }) });
    const res = createMockRes();
    //@ts-expect-error
    res.beforeSent = mock((cb: (res: Response) => void) => { cb(res); });
    routes[0].handler(req, res);
    expect(res.beforeSent).toHaveBeenCalled();
    expect(req.cookies).toEqual({ a: "1" });
  });
});

describe("builtin.staticFiles", () => {
  it("throws error if target is not a directory", () => {
    expect(() => staticFiles([], "/static", __filename)).toThrow("static target is not a directory");
  });

  it("adds a static files route", () => {
    const routes: EndpointRoute[] = [];
    staticFiles(routes, "/static", __dirname);
    expect(routes.length).toBe(1);
    expect(routes[0].splitPath).toEqual(["static"]);
  });

  it("redirects index file to root", () => {
    const routes: EndpointRoute[] = [];
    staticFiles(routes, "/static", __dirname, "index.html");
    const res = createMockRes();
    res.sendRedirect = mock(() => { });
    const req = createMockReq({ path: "/static/index.html" });
    routes[0].handler(req, res);
    expect(res.sendRedirect).toHaveBeenCalledWith("/static/", true);
  });

  it("returns if path exceeds deepestLevel", () => {
    const routes: EndpointRoute[] = [];
    staticFiles(routes, "/static", __dirname, "index.html", 2);
    const req = createMockReq({ path: "/static/a/b/c", splitPath: ["static", "a", "b", "c"] });
    const res = createMockRes();
    const result = routes[0].handler(req, res);
    expect(result).toBeUndefined();
  });

  it("serves a file if it exists", async () => {
    const routes: EndpointRoute[] = [];
    staticFiles(routes, "/static", __dirname);
    const req = createMockReq({
      path: "/static/builtin.test.ts",
      splitPath: ["static", "builtin.test.ts"],
      pathParams: ["builtin.test.ts"]  // ← was [], needs the filename
    });
    const res = createMockRes();
    await routes[0].handler(req, res);
    expect(res.send).toHaveBeenCalled();
  });

  it("sends 404 if file does not exist", async () => {
    const routes: EndpointRoute[] = [];
    staticFiles(routes, "/static", __dirname);
    const req = createMockReq({ path: "/static/does-not-exist.txt", splitPath: ["static", "does-not-exist.txt"], pathParams: [] });
    const res = createMockRes();
    await routes[0].handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
