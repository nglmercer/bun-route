import { describe, expect, it } from "bun:test"
import type { EndpointRoute } from "../types"
import { parseHttpMethods } from "../method"
import { socketio, SioServer } from "../../examples/socket-io/adapter"

describe("socketio adapter", () => {
  it("legacy socketio() adds a route with default path", () => {
    const routes: EndpointRoute[] = []
    socketio(routes)
    expect(routes.length).toBe(1)
    expect(routes[0].splitPath).toBeDefined()
    expect(routes[0].method).toEqual(parseHttpMethods("*"))
    expect(routes[0].middlewareName).toBe("socketio")
  })

  it("legacy socketio() adds a route with custom path", () => {
    const routes: EndpointRoute[] = []
    socketio(routes, { path: "/ws" })
    expect(routes.length).toBe(1)
    expect(routes[0].splitPath).toBeDefined()
    expect(routes[0].middlewareName).toBe("socketio")
  })

  it("legacy socketio() returns the routes array", () => {
    const routes: EndpointRoute[] = []
    const result = socketio(routes)
    expect(result).toBe(routes)
    expect(result.length).toBe(1)
  })

  it("new SioServer.attach() adds a route", () => {
    const routes: EndpointRoute[] = []
    const io = new SioServer()
    io.attach(routes)
    expect(routes.length).toBe(1)
    expect(routes[0].middlewareName).toBe("socketio")
  })

  it("SioServer.ws is a WebSocket handler", () => {
    const io = new SioServer()
    expect(io.ws).toBeDefined()
    expect(typeof io.ws.open).toBe("function")
    expect(typeof io.ws.message).toBe("function")
    expect(typeof io.ws.close).toBe("function")
  })

  it("legacy socketio() can be called multiple times with different paths", () => {
    const routes: EndpointRoute[] = []
    socketio(routes, { path: "/socket.io" })
    socketio(routes, { path: "/socket.io/admin" })
    expect(routes.length).toBe(2)
    expect(routes[0].middlewareName).toBe("socketio")
    expect(routes[1].middlewareName).toBe("socketio")
  })

  it("getIO returns the last io instance", () => {
    const { getIO } = require("../../examples/socket-io/adapter")
    const routes1: EndpointRoute[] = []
    socketio(routes1)
    const io = getIO()
    expect(io).toBeInstanceOf(SioServer)
    expect(io!.path).toBe("/socket.io")
  })

  it("handler is a function on the registered route", () => {
    const routes: EndpointRoute[] = []
    socketio(routes)
    expect(typeof routes[0].handler).toBe("function")
  })

  it("splitPath contains double wildcard", () => {
    const routes: EndpointRoute[] = []
    socketio(routes, { path: "/chat" })
    const splitPath = routes[0].splitPath
    expect(splitPath).toBeDefined()
    expect(splitPath).toContain("**")
  })

  it("route matches all HTTP methods", () => {
    const routes: EndpointRoute[] = []
    socketio(routes)
    expect(routes[0].method).toEqual(parseHttpMethods("*"))
  })
})
