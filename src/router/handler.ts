import type { Server } from "bun"
import { ResponseBuilder, HTTP_STATUS } from "../responseBuilder"
import { parseHttpMethods } from "../method"
import { splitPath, requestPathMatchesRouteDefinition } from "../path"
import type { Awaitable, BunRequestHandler, EndpointRoute, Request, WebSocketData } from "../types"
import { BunRequest } from "../request"
import { HttpMethod } from "../method"

/**
 * Handles a request.
 * This function creates the ResponseBuilder and modifies the base bun request.
 * @param routes The routes to match against
 * @param req A request to handle
 * @param server A server to handle it on
 * @returns Bun response, void or a promise of response or void
 */
export function innerHandle(
    routes: EndpointRoute[],
    request: BunRequest,
    server: Server<WebSocketData>
): Awaitable<Response> {
    const res = new ResponseBuilder()
    const req = request as Request
    req.httpMethod = parseHttpMethods(req.method)
    req.server = server
    req.cookies = {}
    const url = new URL(req.url)
    req.path = url.pathname
    req.splitPath = splitPath(req.path)
    const cookieHeader = req.headers.get("cookie")
    if (cookieHeader) {
        for (const part of cookieHeader.split(";")) {
            const [key, ...rest] = part.trim().split("=")
            if (key) {
                req.cookies[key.trim()] = decodeURIComponent(rest.join("=").trim())
            }
        }
    }
    // Parse query parameters
    const searchParams = url.searchParams
    const queryParams: Record<string, string> = {}
    for (const [key, value] of searchParams) {
        queryParams[key] = value
    }
    req.queryParams = queryParams
    req.query = (key?: string) => {
        if (key === undefined) {
            return { ...queryParams }
        }
        // Check for repeated keys (array values)
        const values = searchParams.getAll(key)
        if (values.length > 1) {
            return values
        }
        return searchParams.get(key) ?? undefined
    }
    req.queries = (key: string) => {
        return searchParams.getAll(key)
    }

    // Parse IP addresses
    const sock = req.server.requestIP(req)
    if (!sock) {
        return new Response("Request closed early", { status: HTTP_STATUS.INTERNAL_SERVER_ERROR })
    }
    req.sock = sock

    const forwardedFor = req.headers.get("x-forwarded-for")
    if (forwardedFor) {
        req.ips = forwardedFor.split(",").map(ip => ip.trim())
        req.ip = req.ips[0]
    } else {
        req.ip = sock.address
        req.ips = [req.ip]
    }

    const p = route(routes, req, res)
    if (
        p &&
        p.then != undefined
    ) {
        return p.then(
            () => {
                if (req.upgraded) {
                    return undefined as unknown as Response
                }
                const p = res.startBeforeSentHook()
                if (
                    p &&
                    p.then != undefined
                ) {
                    return p.then(() => {
                        return res.build()
                    })
                }

                return res.build()
            }
        )
    }

    if (req.upgraded) {
        return undefined as unknown as Response
    }
    const p2 = res.startBeforeSentHook()
    if (
        p2 &&
        p2.then != undefined
    ) {
        return p2.then(() => {
            return res.build()
        })
    }

    return res.build()
}

/**
 * This function will route a request to the correct handler based on the request's method and path.
 * Recursively calls middlewares until a handler sets `res.submit` to true or `req.upgraded` to true.
 * 
 * First handles the request synchronously until a async middleware is hit.
 * Then its uses the routeAsync function to handle it in a promise.
 * 
 * If no async middleware is hit the request is handled fully synchronously.
 * @param routes The routes to match against
 * @param req A modified bun request to handle
 * @param res A response builder
 * @returns Bun response, void or a promise of response or void
 */
export function route(
    routes: EndpointRoute[],
    req: Request,
    res: ResponseBuilder
): Awaitable<void> {
    for (let i = 0; i < routes.length; i++) {
        if (
            routes[i].method != HttpMethod.ALL &&
            routes[i].method != req.httpMethod
        ) {
            continue
        }

        const pathParams = requestPathMatchesRouteDefinition(
            req.splitPath,
            routes[i].splitPath,
        )

        if (pathParams === false) {
            continue
        } else if (pathParams !== true) {
            req.pathParams = pathParams as string[] | Record<string, string>
        }

        const p = routes[i].handler(req, res)
        if (
            p != undefined &&
            p.then != undefined
        ) {
            return routeAsync(routes, i, p, req, res)
        }

        if (
            res.submit === true ||
            req.upgraded === true
        ) {
            return
        }
    }

    if (req.upgraded) {
        return
    }

    res.reset()
        .status(HTTP_STATUS.NOT_FOUND)
        .body("Not found")
}

/**
 * Is a followup of the route function. Is used if the route function hits a async middleware.
 * The route function will provide the initialDefIndex when routeAsync is called.
 * The initialDefIndex is the index of the first found async middleware in the route function.
 *
 * If route dont hits a async middleware, routeAsync dont get called
 * @param routes The routes to match against
 * @param initialDefIndex The index of the first found async middleware in the route function
 * @param promise The promise returned by the first async middleware found by the route function
 * @param req A modified bun request to handle
 * @param res A response builder
 * @returns Bun response, void or a promise of response or void
 */
export async function routeAsync(
    routes: EndpointRoute[],
    initialDefIndex: number,
    promise: Promise<void>,
    req: Request,
    res: ResponseBuilder
): Promise<void> {
    await promise

    if (
        res.submit === true ||
        req.upgraded === true
    ) {
        return
    }

    for (let i = initialDefIndex + 1; i < routes.length; i++) {
        if (
            routes[i].method != HttpMethod.ALL &&
            routes[i].method != req.httpMethod
        ) {
            continue
        }

        const pathParams = requestPathMatchesRouteDefinition(
            req.splitPath,
            routes[i].splitPath,
        )

        if (pathParams === false) {
            continue
        } else if (pathParams !== true) {
            req.pathParams = pathParams as string[] | Record<string, string>
        }

        const p = routes[i].handler(req, res)
        if (
            p &&
            p.then != undefined
        ) {
            await p
        }

        if (
            (res.submit as boolean) === true ||
            req.upgraded === true
        ) {
            return
        }
    }

    if (req.upgraded) {
        return
    }

    res.reset()
        .status(HTTP_STATUS.NOT_FOUND)
        .body("Not found")
}

/**
 * Creates a BunRequestHandler that uses the given routes.
 * @param routes The routes to use
 * @returns A BunRequestHandler
 */
export function createHandler(
    routes: EndpointRoute[]
): BunRequestHandler {
    return (request: BunRequest, server: Server<WebSocketData>) =>
        innerHandle(routes, request, server)
}
