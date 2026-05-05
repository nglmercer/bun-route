import { describe, expect, it, mock } from "bun:test";
import { ws, redirect, staticFiles, basicAuth, cookies } from "../router/builtin";
import { parseHttpMethods } from "../method";
import type { EndpointRoute, Request } from "../types";

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
    const req = {
      server: { upgrade: upgradeMock },
      upgraded: false
    } as any as Request;
    const res = {} as any;
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
    const res = {
      sendRedirect: mock((target: string, perma: boolean) => {
        expect(target).toBe("/new");
        expect(perma).toBe(false);
      })
    } as any;
    routes[0].handler({} as any, res);
    expect(res.sendRedirect).toHaveBeenCalled();
  });

  it("uses 301 when perma is true", () => {
    const routes: EndpointRoute[] = [];
    redirect(routes, "GET", "/old", "/new", true);
    const res = {
      sendRedirect: mock((target: string, perma: boolean) => {
        expect(perma).toBe(true);
      })
    } as any;
    routes[0].handler({} as any, res);
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
    const res = {
      sendBasicAuth: mock(() => {})
    } as any;
    const req = { headers: new Headers() } as any;
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).toHaveBeenCalled();
  });

  it("validates credentials correctly", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", (u, p) => u === "admin" && p === "secret");
    const res = {
      sendBasicAuth: mock(() => {})
    } as any;
    const authValue = btoa("admin:secret");
    const req = { headers: new Headers({ authorization: `Basic ${authValue}` }) } as any;
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).not.toHaveBeenCalled();
  });

  it("sends auth header on invalid credentials", () => {
    const routes: EndpointRoute[] = [];
    basicAuth(routes, "GET", "/protected", () => false);
    const res = {
      sendBasicAuth: mock(() => {})
    } as any;
    const authValue = btoa("user:wrong");
    const req = { headers: new Headers({ authorization: `Basic ${authValue}` }) } as any;
    routes[0].handler(req, res);
    expect(res.sendBasicAuth).toHaveBeenCalled();
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
    const req = {
      headers: new Headers({ cookie: "a=1" }),
      cookies: undefined,
      originCookies: undefined
    } as any;
    routes[0].handler(req, {} as any);
    expect(req.cookies).toEqual({ a: "1" });
  });
});
