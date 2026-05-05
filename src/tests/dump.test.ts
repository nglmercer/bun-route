import { describe, expect, it } from "bun:test";
import { getDefinitionString, dump } from "../router/dump";
import type { EndpointRoute } from "../types";
import { splitRoutePath } from "../path";
import { parseHttpMethods } from "../method";

describe("dump.getDefinitionString", () => {
  it("returns correct method, path and handler name", () => {
    const route: EndpointRoute = {
      splitPath: splitRoutePath("/test"),
      method: parseHttpMethods("GET"),
      handler: function testHandler() {}
    };
    const [method, path, name] = getDefinitionString(route, route.handler, false);
    expect(method).toBe("GET");
    expect(path).toBe("/test");
    expect(name).toBe("testHandler");
  });

  it("shows merged marker when mergedToTop is true", () => {
    const route: EndpointRoute = {
      splitPath: splitRoutePath("/test"),
      method: parseHttpMethods("GET"),
      handler: () => {}
    };
    const [method] = getDefinitionString(route, route.handler, true);
    expect(method).toBe("^ (M)");
  });

  it("shows [anonym] for anonymous handlers", () => {
    const route: EndpointRoute = {
      splitPath: splitRoutePath("/test"),
      method: parseHttpMethods("GET"),
      handler: () => {}
    };
    const [, , name] = getDefinitionString(route, route.handler, false);
    expect(name).toBe("[anonym]");
  });
});

describe("dump.dump", () => {
  it("throws error when no routes", () => {
    expect(() => dump([])).toThrow("No endpoint routes defined");
  });

  it("returns string with endpoint info", () => {
    const routes: EndpointRoute[] = [{
      splitPath: splitRoutePath("/test"),
      method: parseHttpMethods("GET"),
      handler: function testHandler() {}
    }];
    const result = dump(routes);
    expect(result).toContain("Defined endpoints:");
    expect(result).toContain("GET");
    expect(result).toContain("/test");
    expect(result).toContain("testHandler");
  });

  it("includes server url when provided", () => {
    const routes: EndpointRoute[] = [{
      splitPath: splitRoutePath("/test"),
      method: parseHttpMethods("GET"),
      handler: () => {}
    }];
    const mockServer = { url: "http://localhost:3000" } as any;
    const result = dump(routes, mockServer);
    expect(result).toContain("Server is listening on http://localhost:3000");
  });
});
