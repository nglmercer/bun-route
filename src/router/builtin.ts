import { statSync } from "fs"
import { join } from "path"
import { splitRoutePath } from "../path"
import { parseHttpMethods, HttpMethodString } from "../method"
import type { EndpointRoute, RequestMiddleware, WebSocketData } from "../types"

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
    const wsMiddleware: RequestMiddleware = (req, res) => {
        const createdAt = Date.now()
        const data: WebSocketData = {
            createdAt: createdAt,
            channelId: crypto.randomUUID()
        }
        if (req.server.upgrade(req, { data: data })) { //TODO: fix bun/node type errors
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
        (_, res) => res.sendRedirect(redirectTarget, perma)

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
    if (!statSync(targetDir).isDirectory()) {
        throw new Error("static target is not a directory: " + targetDir)
    }

    const staticMiddleware: RequestMiddleware =
        (req, res) => {
            if (req.path.endsWith("/" + indexFile)) {
                res.sendRedirect(
                    req.path.slice(0, -indexFile.length),
                    true,
                )
                return
            }

            let targetPath = join(
                targetDir,
                req.splitPath == undefined ?
                    "/" :
                    req.path
            )

            if (targetPath.endsWith("/")) {
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
                        res.send(await file.arrayBuffer())
                    } else {
                        res.status(404)
                    }
                }).catch(() => {
                    res.status(500, "Error while loading response content")
                })
            } catch (_) {
                res.status(500, "Error while init response content")
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
 * Register a basic auth middleware.
 * @param routes The routes array to add to
 * @param method The HTTP method(s) to match
 * @param path The path to protect with basic auth
 * @param validator The validator function that returns true if credentials are valid
 * @param realm The realm to display in the auth dialog
 * @param charset The charset to use for the auth header
 * @returns The updated routes array.
 */
export function basicAuth(
    routes: EndpointRoute[],
    method: "*" | HttpMethodString,
    path: string,
    validator: ((username: string, password: string) => boolean),
    realm: string = "User Visible Realm",
    charset: string = "UTF-8",
): EndpointRoute[] {
    const basicAuthMiddleware: RequestMiddleware = (req, res) => {
        const auth = req.headers.get("authorization")
        if (!auth) {
            res.sendBasicAuth(
                "Missing authorization header",
                realm,
                charset
            )
            return
        }
        let splitIndex = auth.indexOf(" ")
        if (splitIndex === -1) {
            res.sendBasicAuth(
                "Unprocessable authorization header",
                realm,
                charset
            )
            return
        }

        const schema = auth.slice(0, splitIndex)
        if (schema !== "Basic") {
            res.sendBasicAuth(
                "Unprocessable basic auth schema",
                realm,
                charset
            )
            return
        }

        const credentials = atob(auth.slice(splitIndex + 1))

        splitIndex = credentials.indexOf(":")
        if (splitIndex === -1) {
            res.sendBasicAuth(
                "Unprocessable basic auth credentials",
                realm,
                charset
            )
            return
        }

        if (!validator(
            credentials.slice(0, splitIndex),
            credentials.slice(splitIndex + 1)
        )) {
            res.sendBasicAuth(
                "Invalid credentials",
                realm,
                charset
            )
            return
        }
    }

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods(method),
        handler: basicAuthMiddleware
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
            (req, res) => {
                res.beforeSent(
                    (res) => storeCookies(req, res)
                )
                parseCookies(req)
            } :
            (req) => parseCookies(req)

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods(method),
        handler: cookiesMiddleware
    })

    return routes
}
