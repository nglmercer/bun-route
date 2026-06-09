import { handlerName } from "../../../src/index"
import type { Router } from "../../../src/index"

export function registerResponseRoutes(router: Router): void {
  router.get("/api/response/json", handlerName("responseJson", ({ res }) => {
    res.status(201).json({ created: true })
  }))

  router.get("/api/response/text", handlerName("responseText", ({ res }) => {
    res.status(200).text("Plain text response")
  }))

  router.get("/api/response/html", handlerName("responseHtml", ({ res }) => {
    res.status(200).html("<h1>HTML Response</h1><p>from router-bun</p>")
  }))

  router.get("/api/response/cookie", handlerName("responseCookie", ({ res }) => {
    res.setCookie("session", "abc123", { HttpOnly: true, Path: "/", MaxAge: 3600 })
    res.setCookie("theme", "dark", { Path: "/", MaxAge: 86400 })
    res.json({ message: "Cookies set" })
  }))

  router.get("/api/response/headers", handlerName("responseHeaders", ({ res }) => {
    res.setHeader("X-Custom", "hello")
    res.setHeader("X-Version", "1.0")
    res.json({ message: "Custom headers set" })
  }))

  router.get("/api/response/redirect", handlerName("responseRedirect", ({ res }) => {
    res.sendRedirect("/api/info", false)
  }))

  router.get("/api/response/no-content", handlerName("responseNoContent", ({ res }) => {
    res.status(204).send()
  }))

  router.get("/api/response/error", handlerName("responseError", ({ res }) => {
    res.status(422).json({ error: "Validation failed", details: ["name is required"] })
  }))

  router.get("/api/response/cache", handlerName("responseCache", ({ res }) => {
    res.cache("public, max-age=3600").json({ cached: true })
  }))
}
