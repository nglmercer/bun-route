import { describe, test, expect } from "bun:test"
import { mergeRequestMiddlewares, unmergeRequestMiddleware, isMergedRequestMiddleware, isMergeableEndpointRoute } from "../middleware"
import type { Request, ResponseBuilder, EndpointRoute } from "../types"
import { HttpMethod } from "../method"

describe("mergeRequestMiddlewares", () => {
  test("throws when no middlewares", () => {
    expect(() => mergeRequestMiddlewares()).toThrow("no middlewares specified")
  })

  test("returns single middleware when only one", () => {
    const mw = (req: Request, res: ResponseBuilder) => {}
    const result = mergeRequestMiddlewares(mw)
    expect(result).toBe(mw)
  })

  test("merges multiple sync middlewares", () => {
    const order: number[] = []
    const mw1 = (req: Request, res: ResponseBuilder) => { order.push(1) }
    const mw2 = (req: Request, res: ResponseBuilder) => { order.push(2) }
    const merged = mergeRequestMiddlewares(mw1, mw2)
    merged({} as Request, {} as ResponseBuilder)
    expect(order).toEqual([1,2])
  })

  test("stops sync middlewares when res.submit is true", () => {
    const order: number[] = []
    const mw1 = (req: Request, res: ResponseBuilder) => { order.push(1); (res as any).submit = true }
    const mw2 = (req: Request, res: ResponseBuilder) => { order.push(2) }
    const merged = mergeRequestMiddlewares(mw1, mw2)
    merged({} as Request, { submit: false } as any as ResponseBuilder)
    expect(order).toEqual([1])
  })

  test("stops sync middlewares when req.upgraded is true", () => {
    const order: number[] = []
    const mw1 = (req: Request, res: ResponseBuilder) => { order.push(1); (req as any).upgraded = true }
    const mw2 = (req: Request, res: ResponseBuilder) => { order.push(2) }
    const merged = mergeRequestMiddlewares(mw1, mw2)
    merged({ upgraded: false } as any as Request, {} as ResponseBuilder)
    expect(order).toEqual([1])
  })

  test("handles async middleware", async () => {
    const order: number[] = []
    const mw1 = (req: Request, res: ResponseBuilder) => {
      order.push(1)
      return new Promise<void>(resolve => setTimeout(() => { order.push(2); resolve() }, 10))
    }
    const mw2 = (req: Request, res: ResponseBuilder) => { order.push(3) }
    const merged = mergeRequestMiddlewares(mw1, mw2)
    await merged({} as Request, {} as ResponseBuilder)
    expect(order).toEqual([1,2,3])
  })

  test("stops async middlewares when res.submit is true after await", async () => {
    const order: number[] = []
    const mw1 = (req: Request, res: ResponseBuilder) => {
      order.push(1)
      return new Promise<void>(resolve => setTimeout(() => { (res as any).submit = true; order.push(2); resolve() }, 10))
    }
    const mw2 = (req: Request, res: ResponseBuilder) => { order.push(3) }
    const merged = mergeRequestMiddlewares(mw1, mw2)
    await merged({} as Request, { submit: false } as any as ResponseBuilder)
    expect(order).toEqual([1,2])
  })
})

describe("unmergeRequestMiddleware", () => {
  test("unmerges merged middleware", () => {
    const mw1 = (req: Request, res: ResponseBuilder) => {}
    const mw2 = (req: Request, res: ResponseBuilder) => {}
    const merged = mergeRequestMiddlewares(mw1, mw2)
    const unmerged = unmergeRequestMiddleware(merged)
    expect(unmerged).toEqual([mw1, mw2])
  })
})

describe("isMergedRequestMiddleware", () => {
  test("returns true for merged middleware", () => {
    const mw1 = (req: Request, res: ResponseBuilder) => {}
    const mw2 = (req: Request, res: ResponseBuilder) => {}
    const merged = mergeRequestMiddlewares(mw1, mw2)
    expect(isMergedRequestMiddleware(merged)).toBe(true)
  })

  test("returns false for normal middleware", () => {
    const mw = (req: Request, res: ResponseBuilder) => {}
    expect(isMergedRequestMiddleware(mw)).toBe(false)
  })
})

describe("isMergeableEndpointRoute", () => {
  test("returns false for different methods", () => {
    const route1 = { method: HttpMethod.GET, splitPath: undefined } as EndpointRoute
    const route2 = { method: HttpMethod.POST, splitPath: undefined } as EndpointRoute
    expect(isMergeableEndpointRoute(route1, route2)).toBe(false)
  })

  test("returns true when both splitPath are undefined", () => {
    const route1 = { method: HttpMethod.GET, splitPath: undefined } as EndpointRoute
    const route2 = { method: HttpMethod.GET, splitPath: undefined } as EndpointRoute
    expect(isMergeableEndpointRoute(route1, route2)).toBe(true)
  })

  test("returns false when one splitPath is undefined and the other is defined", () => {
    const route1 = { method: HttpMethod.GET, splitPath: undefined } as EndpointRoute
    const route2 = { method: HttpMethod.GET, splitPath: ["test"] } as EndpointRoute
    expect(isMergeableEndpointRoute(route1, route2)).toBe(false)
  })

  test("returns true when splitPath join matches", () => {
    const route1 = { method: HttpMethod.GET, splitPath: ["a", "b"] } as EndpointRoute
    const route2 = { method: HttpMethod.GET, splitPath: ["a", "b"] } as EndpointRoute
    expect(isMergeableEndpointRoute(route1, route2)).toBe(true)
  })

  test("returns false when splitPath join does not match", () => {
    const route1 = { method: HttpMethod.GET, splitPath: ["a", "b"] } as EndpointRoute
    const route2 = { method: HttpMethod.GET, splitPath: ["a", "c"] } as EndpointRoute
    expect(isMergeableEndpointRoute(route1, route2)).toBe(false)
  })
})
