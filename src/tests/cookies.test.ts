import { describe, expect, it, mock } from "bun:test";
import { parseCookies, storeCookies } from "../router/cookies";

describe("parseCookies", () => {
  it("sets empty cookies when no cookie header", () => {
    const req = {
      headers: new Headers(),
      cookies: undefined,
      originCookies: undefined
    } as any;

    parseCookies(req);
    expect(req.cookies).toEqual({});
    expect(req.originCookies).toEqual({});
  });

  it("parses single cookie", () => {
    const req = {
      headers: new Headers({ cookie: "session=abc123" }),
      cookies: undefined,
      originCookies: undefined
    } as any;

    parseCookies(req);
    expect(req.cookies).toEqual({ session: "abc123" });
    expect(req.originCookies).toEqual({ session: "abc123" });
  });

  it("parses multiple cookies", () => {
    const req = {
      headers: new Headers({ cookie: "a=1; b=2; c=3" }),
      cookies: undefined,
      originCookies: undefined
    } as any;

    parseCookies(req);
    expect(req.cookies).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("trims cookie name spaces", () => {
    const req = {
      headers: new Headers({ cookie: "  name = value  " }),
      cookies: undefined,
      originCookies: undefined
    } as any;

    parseCookies(req);
    expect(req.cookies).toEqual({ name: "value" });
  });

  it("forceReload resets to origin cookies", () => {
    const req = {
      headers: new Headers({ cookie: "a=1" }),
      cookies: { a: "1", b: "2" },
      originCookies: { a: "1" }
    } as any;

    parseCookies(req, true);
    expect(req.cookies).toEqual({ a: "1" });
  });

  it("does not reparse when originCookies exists and no forceReload", () => {
    const req = {
      headers: new Headers({ cookie: "new=val" }),
      cookies: { old: "val" },
      originCookies: { old: "val" }
    } as any;

    parseCookies(req);
    expect(req.cookies).toEqual({ old: "val" });
  });
});

describe("storeCookies", () => {
  it("sends 500 when no request cookies", () => {
    const res = {
      reset: mock(() => res),
      status: mock(() => res),
      send: mock(() => res)
    } as any;
    const req = { cookies: undefined } as any;

    storeCookies(req, res);
    expect(res.reset).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Request cookies store error");
  });

  it("sets new cookies", () => {
    const res = {
      setCookie: mock(() => res)
    } as any;
    const req = {
      cookies: { a: "1" },
      originCookies: {}
    } as any;

    storeCookies(req, res);
    expect(res.setCookie).toHaveBeenCalledWith("a", "1");
  });

  it("updates changed cookies", () => {
    const res = {
      setCookie: mock(() => res)
    } as any;
    const req = {
      cookies: { a: "2" },
      originCookies: { a: "1" }
    } as any;

    storeCookies(req, res);
    expect(res.setCookie).toHaveBeenCalledWith("a", "2");
  });

  it("unsets deleted cookies", () => {
    const res = {
      unsetCookie: mock(() => res)
    } as any;
    const req = {
      cookies: {},
      originCookies: { a: "1" }
    } as any;

    storeCookies(req, res);
    expect(res.unsetCookie).toHaveBeenCalledWith("a");
  });

  it("does nothing when no changes", () => {
    const res = {
      setCookie: mock(() => res),
      unsetCookie: mock(() => res)
    } as any;
    const req = {
      cookies: { a: "1" },
      originCookies: { a: "1" }
    } as any;

    storeCookies(req, res);
    expect(res.setCookie).not.toHaveBeenCalled();
    expect(res.unsetCookie).not.toHaveBeenCalled();
  });
});
