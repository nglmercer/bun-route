import { type Server } from "bun"
import type { BunRequestHandler, EndpointRoute, RequestMiddleware, WebSocketData, Request } from "./types"
import { HttpMethodString, stringifyHttpMethods } from "./method"
import { RESPONSE_DEFAULTS } from "./responseBuilder"

// Import modularized components
import { parseCookies, storeCookies } from "./router/cookies"
import { dump as dumpRoutes } from "./router/dump"
import { createHandler } from "./router/handler"
import {
    use as registerUse,
    get as registerGet,
    post as registerPost,
    put as registerPut,
    deleteMethod as registerDelete,
    patch as registerPatch,
    trace as registerTrace,
    head as registerHead,
    connect as registerConnect,
    options as registerOptions,
} from "./router/registration"
import {
    ws as registerWs,
    redirect as registerRedirect,
    staticFiles as registerStatic,
    basicAuth as registerBasicAuth,
    cookies as registerCookies,
} from "./router/builtin"

/**
 * ## Simple Router
 * ### About
 * A simple express-like router written for bun serve.
 * 
 * ### Author
 * By [NobleMajo](https://github.com/NobleMajo)
 * @see https://github.com/NobleMajo
 * 
 * ### Usage:
 * You can use the bun.serve function and use router.handle as fetch parameter of the settings:
 * ```ts
 * export const server = Bun.serve({
 *     fetch: router.handle,
 * })
 * ```
 * 
 * But you can also use the convenient router.listen function: 
 * ```ts
 * const server = router.listen()
 * ```
 */
export class Router {
    routes: EndpointRoute[] = []
    mergeHandlers: boolean = true

    // Expose cookie methods as static
    static parseCookies = parseCookies
    static storeCookies = storeCookies

    /**
     * Prints a table of all endpoints defined in this router.
     *
     * If a server is given as a parameter, a running message with the url of the server is printed too.
     * @param server The server to print the url of
     * @returns A string representing the table of endpoints
     */
    dump(...servers: Server<WebSocketData>[]): string {
        return dumpRoutes(this.routes, ...servers)
    }

    /**
     * Returns all registered routes as a structured object.
     * Useful for API documentation or creating dynamic endpoint listings.
     * @returns An array of route objects with method and path
     */
    getRoutes(): Array<{ method: string; path: string }> {
        return this.routes.map((route) => ({
            method: stringifyHttpMethods(route.method),
            path: route.splitPath ? "/" + route.splitPath.join("/") : "/",
        }))
    }

    /**
     * This function can be used as fetch handler for bun.serve.
     * It will route a request to the correct handler based on the request's method and path.
     * @param request A bun request object
     * @param server A bun server object
     * @returns Bun response, void or a promise of response or void
     */
    handle: BunRequestHandler = createHandler(this.routes)

    /**
     * Send a request directly to the router without an HTTP server.
     * Useful for testing.
     * @param request A Request object, or a URL string.
     * @param options RequestInit options if the first param is a string.
     * @returns A promise of the Response object returned by the handler.
     */
    request(request: Request | string, options?: RequestInit): Promise<Response> {
        const req = typeof request === "string" ? new Request(request, options) : request;
        const res = this.handle(req as Request, {
            requestIP: () => ({ address: "127.0.0.1", family: "IPv4", port: 0 })
        } as unknown as Server<WebSocketData>);
        return Promise.resolve(res as Response);
    }

    /**
     * Register a handler to run for all incoming requests.
     * @param method The HTTP method to run the handler on (undefined = all)
     * @param path The path to run the handler on (undefined = all)
     * @param handlers The handler(s) to run
     * @returns The router
     */
    use(
        method: "*" | HttpMethodString,
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerUse(this.routes, this.mergeHandlers, method, path, handler, ...handlers)
        return this
    }

    /**
     * Registers a route for the `GET` HTTP method.
     * @param path The route path.
     * @param handler The handler function for the route.
     * @param handlers Additional middleware functions to apply to the route.
     * @returns The router instance.
     */
    get(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerGet(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Register a handler to run on incoming POST requests.
     * @param path The path to run the handler on
     * @param handler The handler(s) to run
     * @returns The router
     */
    post(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerPost(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Register a PUT route.
     * @param path The path to match.
     * @param handler The handler for the route.
     * @param handlers Additional handlers to run before the main handler.
     * @returns The Router instance.
     */
    put(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerPut(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Register a middleware function to handle DELETE requests to `path`.
     * @param path The path to register the handler for.
     * @param handler The middleware function to call.
     * @param handlers Additional middleware functions to call.
     * @returns this
     */
    delete(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerDelete(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Register a middleware function to handle PATCH requests to `path`.
     * @param path The path to register the handler for.
     * @param handler The middleware function to call.
     * @param handlers Additional middleware functions to call.
     * @returns this
     */
    patch(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerPatch(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Add a route for the HTTP TRACE method.
     * The TRACE method is used to invoke a remote, application-layer loop-back
     * of the request message.
     * @param path The path this route will match.
     * @param handler The handler to invoke when this route is matched.
     * @param handlers Additional handlers to run when this route is matched.
     * @returns This router, for chaining.
     */
    trace(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerTrace(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Registers a route for the `HEAD` HTTP method.
     * @param path The route path.
     * @param handler The handler function for the route.
     * @param handlers Additional middleware functions to apply to the route.
     * @returns The router instance.
     */
    head(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerHead(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Register a handler to run for CONNECT requests on the given path.
     * @param path The path to run the handler on
     * @param handler The handler to run
     */
    connect(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerConnect(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Register a handler to run on OPTIONS requests.
     * @param path The path to run the handler on (undefined = all)
     * @param handler The handler(s) to run
     * @returns The router
     */
    options(
        path: string,
        handler: RequestMiddleware,
        ...handlers: RequestMiddleware[]
    ): Router {
        registerOptions(this.routes, this.mergeHandlers, path, handler, ...handlers)
        return this
    }

    /**
     * Upgrade a request to a websocket connection.
     * @param path The path to use for the websocket connection.
     * @returns The router, for chaining.
     */
    ws(path: string): Router {
        registerWs(this.routes, path)
        return this
    }

    redirect(
        method: "*" | HttpMethodString,
        path: string,
        redirectTarget: string,
        perma: boolean = false,
    ): Router {
        registerRedirect(this.routes, method, path, redirectTarget, perma)
        return this
    }

    static(
        path: string,
        targetDir: string,
        indexFile: string = "index.html",
        deepestLevel: number = 10,
    ): Router {
        registerStatic(this.routes, path, targetDir, indexFile, deepestLevel)
        return this
    }

    basicAuth(
        method: "*" | HttpMethodString,
        path: string,
        validator: ((username: string, password: string) => boolean),
        realm: string = RESPONSE_DEFAULTS.REALM,
        charset: string = RESPONSE_DEFAULTS.CHARSET,
    ): Router {
        registerBasicAuth(this.routes, method, path, validator, realm, charset)
        return this
    }

    cookies(
        method: "*" | HttpMethodString,
        path: string,
        autoResponseHeaders: boolean = false,
    ): Router {
        registerCookies(this.routes, method, path, autoResponseHeaders)
        return this
    }
}


