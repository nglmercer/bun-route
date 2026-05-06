import { type Server, type SocketAddress } from "bun"
import { type HttpMethod } from "./method"
import { BunRequest } from "./request"
import type { ResponseBuilder } from "./responseBuilder"
import type { SplitPath } from "./path"
import { QueryParam } from "./router/querybuilder"

export type Awaitable<T> = T | Promise<T>
export type WebSocketData = {
    createdAt: number;
    channelId?: string;
    authToken?: string;
} | undefined;
export type PathParams = string[] | Record<string, string>

export type Request = BunRequest & {
    /**
     * `req.pathParams` is the path parameters of the request.
     * If a wildcard is used in the endpoint route, it is an array of matched segments.
     * If named params (:param) are used, it is an object mapping param names to values.
     * If both are used, named params take precedence in the returned object.
     * Always available in a `Router` handled request when wildcards or named params are used.
     */
    pathParams?: PathParams,
    /**
     * `req.httpMethod` is the HttpMethod enum value of the reuqest method used for routing.
     * It is always available in a `Router` handled request.
     */
    httpMethod: HttpMethod,
    /**
     * `req.path` is the path of the request.
     * It is always available in a `Router` handled request.
     */
    path: string,
    /**
     * `req.splitPath` is the splitted path of the request used for routing.
     * It is always available in a `Router` handled request.
     */
    splitPath: SplitPath,
    /**
     * `req.server` is the server that is handling the request.
     * It is always available in a `Router` handled request.
     */
    server: Server<WebSocketData>,
    /**
     * `req.sock` is the socket address of the request.
     * It is always available in a `Router` handled request.
     */
    sock: SocketAddress,
    /**
     * `req.originCookies` is not to use in your code.
     * It holds the origin cookies state of the request.
     */
    originCookies: unknown,
    /**
     * `req.cookies` is a key value map of all the cookies in the request if parsed earlier.
     * Gets loaded via the `Router.storeCookies(req, res)` function.
     */
    cookies: {
        [key: string]: string | undefined,
    },
    /**
     * `req.rid` is set to true if the request has been upgraded to a websocket.
     */
    upgraded?: true,
    /**
     * `req.id` is the request ID set by the requestId middleware.
     */
    id?: string,
    /**
     * `req.parsedBody` is the parsed request body set by the bodyParser middleware.
     */
    parsedBody?: unknown,
    /**
     * `req.queryParams` is the parsed query parameters from the URL.
     * Always available in a `Router` handled request.
     */
    /**
     * `req.param(key)` returns a single query parameter value.
     * `req.param()` returns all query parameters as a Record.
     */
    param(key: string): QueryParam
    param(key?: undefined): Record<string, QueryParam>
    param(key?: string): QueryParam | Record<string, QueryParam>
    queryParams: Record<string, string>,
    /**
     * `req.query(key)` returns a single query parameter value.
     * `req.query()` returns all query parameters as a Record.
     */
    query(key?: string): string | string[] | Record<string, string> | undefined,
    /**
     * `req.queries(key)` returns all values for a query parameter (for repeated keys like `?tags=A&tags=B`).
     */
    queries(key: string): string[],
    /**
     * `req.ip` is the remote IP address of the request.
     * Always available in a `Router` handled request.
     */
    ip: string,
    /**
     * `req.ips` is the list of IP addresses from X-Forwarded-For header, or a single-element array.
     */
    ips: string[],
}

export type BunRequestHandler = (request: Request, server: Server<WebSocketData>) => Awaitable<Response>

export type RequestMiddleware = (req: Request, res: ResponseBuilder) => Awaitable<void>

export type MergedRequestMiddleware = RequestMiddleware & {
    base: RequestMiddleware[],
}

export interface EndpointRoute {
    handler: RequestMiddleware,
    method: HttpMethod,
    splitPath: SplitPath,
    middlewareName?: string,
}

export interface CookieOptions {
    MaxAge?: number
    Path?: string
    HttpOnly?: boolean
    Secure?: boolean
    SameSite?: 'Strict' | 'Lax' | 'None'
}