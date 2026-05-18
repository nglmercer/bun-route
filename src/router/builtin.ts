import { statSync, existsSync } from "fs"
import { join } from "path"
import { splitRoutePath } from "../path"
import { parseHttpMethods, HttpMethodString } from "../method"
import { PATH_CHARS } from "../path"
import { HTTP_STATUS } from "../responseBuilder"
import type { EndpointRoute, RequestMiddleware, WebSocketData } from "../types"

function generateETag(buffer: ArrayBuffer): string {
    const hash = new Bun.CryptoHasher("md5")
    hash.update(buffer)
    return `"${hash.digest("hex")}"`
}

/**
 * Upgrade a request to a websocket connection.
 * @param routes The routes array to add to
 * @param path The path to use for the websocket connection.
 * @returns The updated routes array.
 */
export function ws(
    routes: EndpointRoute[],
    path: string
): EndpointRoute[] {
    const wsMiddleware: RequestMiddleware = (ctx) => {
        const req = ctx.req
        const createdAt = Date.now()
        const data: WebSocketData = {
            createdAt: createdAt,
            channelId: crypto.randomUUID()
        }
        if (req.server.upgrade(req, { data: data })) {
            req.upgraded = true
        }
    }

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods("GET"),
        handler: wsMiddleware
    })
    return routes
}

/**
 * Register a redirect route.
 * @param routes The routes array to add to
 * @param method The HTTP method(s) to match
 * @param path The path to redirect from
 * @param redirectTarget The path to redirect to
 * @param perma Whether to use a permanent redirect (301 vs 302)
 * @returns The updated routes array.
 */
export function redirect(
    routes: EndpointRoute[],
    method: "*" | HttpMethodString,
    path: string,
    redirectTarget: string,
    perma: boolean = false,
): EndpointRoute[] {
    const redirectMiddleware: RequestMiddleware =
        (ctx) => ctx.res.sendRedirect(redirectTarget, perma)

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods(method),
        handler: redirectMiddleware
    })

    return routes
}

/**
 * Register a static file serving route.
 * @param routes The routes array to add to
 * @param path The path to serve static files from
 * @param targetDir The directory to serve files from
 * @param indexFile The index file to serve for directories
 * @param deepestLevel The maximum path depth to serve
 * @returns The updated routes array.
 */
export function staticFiles(
    routes: EndpointRoute[],
    path: string,
    targetDir: string,
    indexFile: string = "index.html",
    deepestLevel: number = 10,
): EndpointRoute[] {
    if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
        throw new Error("static target is not a directory: " + targetDir)
    }

    const staticMiddleware: RequestMiddleware =
        (ctx) => {
            const req = ctx.req
            const res = ctx.res
            if (req.path.endsWith(PATH_CHARS.SLASH + indexFile)) {
                res.sendRedirect(
                    req.path.slice(0, -indexFile.length),
                    true,
                )
                return
            }

            // Compute relative path from route match
            let relativeParts: string[] = []
            if (req.pathParams !== undefined) {
                if (Array.isArray(req.pathParams)) {
                    relativeParts = req.pathParams
                } else if (typeof req.pathParams === "object") {
                    // Named params - find the wildcard-captured segment or use all values
                    relativeParts = Object.values(req.pathParams)
                } else if (req.pathParams === true) {
                    // Double wildcard matched - use splitPath parts after route
                    relativeParts = req.splitPath ? req.splitPath.slice(1) : []
                }
            }

            let targetPath = join(targetDir, ...relativeParts)

            if (targetPath.endsWith(PATH_CHARS.SLASH)) {
                targetPath += indexFile
            }

            if (
                req.splitPath != undefined &&
                req.splitPath?.length > deepestLevel
            ) {

                return
            }

            try {
                const file = Bun.file(targetPath)
                return file.exists().then(async (exist) => {
                    if (exist) {
                        const buffer = await file.arrayBuffer()
                        const etag = generateETag(buffer)
                        const ifNoneMatch = req.headers.get("if-none-match")

                        if (ifNoneMatch && ifNoneMatch === etag) {
                            res.status(304).send()
                            return
                        }

                        res.setHeader("ETag", etag)
                        res.setHeader("Cache-Control", "public, max-age=0")
                        res.setHeader("Content-Type", file.type || "application/octet-stream")
                        res.send(buffer)
                    } else {
                        res.status(HTTP_STATUS.NOT_FOUND)
                    }
                }).catch(() => {
                    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Error while loading response content")
                })
            } catch (_) {
                res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Error while init response content")
            }
        }

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods("GET"),
        handler: staticMiddleware
    })

    return routes
}

/**
 * Register a cookie parsing middleware.
 * @param routes The routes array to add to
 * @param method The HTTP method(s) to match
 * @param path The path to parse cookies on
 * @param autoResponseHeaders Whether to automatically store cookies in response headers
 * @returns The updated routes array.
 */
export function cookies(
    routes: EndpointRoute[],
    method: "*" | HttpMethodString,
    path: string,
    autoResponseHeaders: boolean = false,
): EndpointRoute[] {
    const { parseCookies, storeCookies } = require("../router/cookies")

    const cookiesMiddleware: RequestMiddleware =
        autoResponseHeaders ?
            (ctx) => {
                const req = ctx.req
                const res = ctx.res
                res.beforeSent(
                    (res) => storeCookies({ req, res })
                )
                parseCookies(req)
            } :
            (ctx) => parseCookies(ctx.req)

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods(method),
        handler: cookiesMiddleware
    })

    return routes
}
