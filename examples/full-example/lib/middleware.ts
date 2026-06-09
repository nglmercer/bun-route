import { Router } from "../../../src/index"

export function setupMiddleware(router: Router): void {
  router.onError((err, { req, res }) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)
    res.status(500).json({ error: "Internal server error", message: err.message })
  })

  router.requestId("*", "/**")
  router.cors("*", "/**", { origin: "*", credentials: true })
  router.cookies("*", "/**", true)

  router.use("*", "/**", ({ req, res }) => {
    const start = Date.now()
    console.log(`--> ${req.method} ${req.path}`)
    res.beforeSent(() => {
      console.log(`<-- ${res.statusCode} ${req.method} ${req.path} [${Date.now() - start}ms]`)
    })
  })

  router.body("*", "/api/**", { json: true, text: true, form: true })
  router.rateLimit("POST", "/api/**", { max: 30, windowMs: 60_000 })
  router.timeout("*", "/api/slow/**", { timeoutMs: 3000, message: "Request took too long" })
  router.static("/static/**", import.meta.dir + "/../public")
  router.redirect("*", "/old", "/api/info", false)
  router.redirect("*", "/legacy", "/api/info", true)
}
