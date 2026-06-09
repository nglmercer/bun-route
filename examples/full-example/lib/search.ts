import { Router, handlerName } from "../../../src/index"

export function registerSearchRoutes(router: Router): void {
  router.get("/api/files/*", handlerName("getFile", ({ req, res }) => {
    const filePath = (req.pathParams as string[]).join("/")
    res.json({ file: filePath, message: "Single wildcard match" })
  }))

  router.get("/api/assets/**", handlerName("getAsset", ({ req, res }) => {
    const filePath = (req.pathParams as string[]).join("/")
    res.json({ asset: filePath, message: "Double wildcard match" })
  }))

  router.get("/api/search", handlerName("search", ({ req, res }) => {
    const q = req.queryParam("q").string("")
    const sort = req.queryParam("sort").enum(["asc", "desc"], "asc")!
    const page = req.queryParam("page").numberBetween(1, 100, 1)!
    const active = req.queryParam("active").boolean(true)
    res.json({ query: q, sort, page, active, results: [] })
  }))

  router.describe("/api/search", {
    queryParams: [
      { name: "q", type: "string", required: true, description: "Search query" },
      { name: "sort", type: "string", required: false, default: "asc", enum: ["asc", "desc"] },
      { name: "page", type: "integer", required: false, default: 1 },
      { name: "active", type: "boolean", required: false, default: true },
    ],
  })
}
