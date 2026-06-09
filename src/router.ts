import { type Server } from "bun";
import type {
  Awaitable,
  BunRequestHandler,
  EndpointRoute,
  RequestMiddleware,
  WebSocketData,
  Request,
  MergedRequestMiddleware,
  Context,
} from "./types";
import { HttpMethodString, stringifyHttpMethods } from "./method";
import { ResponseBuilder, HTTP_STATUS } from "./responseBuilder";
import { splitRoutePath } from "./path";
import { innerHandle } from "./router/handler";
import { isMergedRequestMiddleware } from "./middleware";
// Import modularized components
import { parseCookies, storeCookies } from "./router/cookies";
import {
  dump as dumpRoutes,
  getRouteDefinitions as getDefs,
} from "./router/dump";
import type {
  RouteDefinition,
  QueryParamInfo,
  DumpOptions,
} from "./router/dump";
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
} from "./router/registration";
import {
  ws as registerWs,
  redirect as registerRedirect,
  staticFiles as registerStatic,
  serveStatic as registerServeStatic,
  cookies as registerCookies,
} from "./router/builtin";
import type { ServeStaticOptions } from "./router/builtin";
import { cors as registerCors, type CorsOptions } from "./router/cors";
import {
  bodyParser as registerBodyParser,
  type BodyParserOptions,
} from "./router/bodyParser";
import {
  rateLimit as registerRateLimit,
  type RateLimitOptions,
} from "./router/rateLimit";
import {
  requestId as registerRequestId,
  type RequestIdOptions,
} from "./router/requestId";
import {
  timeout as registerTimeout,
  type TimeoutOptions,
} from "./router/timeout";
import {
  fileUpload as registerFileUpload,
  type FileUploadOptions,
  getFile,
  getFiles,
  getFileFieldNames,
  getFormFields,
} from "./router/fileUpload";
import type { Handler, RouteCollection, AppendRoute } from "./typedRouter";

export type ErrorHandler = (err: Error, ctx: Context) => Awaitable<void>;

/**
 * ## Simple Router
 * ### About
 * A simple express-like router written for bun serve.
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
export class Router<T extends RouteCollection = []> {
  routes: EndpointRoute[] = [];
  mergeHandlers: boolean = true;
  private wsHandlers?: Bun.WebSocketHandler<WebSocketData>;
  private errorHandler?: ErrorHandler;
  private routeMeta = new Map<string, { queryParams?: QueryParamInfo[] }>();
  private _typedRoutes: RouteCollection = [];

  // Expose cookie methods as static
  static parseCookies = parseCookies;
  static storeCookies = storeCookies;

  /**
   * Prints a table of all endpoints defined in this router.
   *
   * If a server is given as a parameter, a running message with the url of the server is printed too.
   * @param optionsOrServer Dump options or first server
   * @param servers Additional servers
   * @returns A string representing the table of endpoints
   */
  dump(
    optionsOrServer?: DumpOptions | Server<WebSocketData>,
    ...servers: Server<WebSocketData>[]
  ): string {
    return dumpRoutes(this.routes, optionsOrServer, ...servers);
  }

  /**
   * Returns all registered routes as a structured object.
   * Useful for API documentation or creating dynamic endpoint listings.
   * @param includeMiddleware Whether to include middleware routes (default: false)
   * @returns An array of route objects with method and path
   */
  getRoutes(
    includeMiddleware: boolean = false,
  ): Array<{ method: string; path: string }> {
    const seen = new Set<string>();
    const result: Array<{ method: string; path: string }> = [];

    for (const route of this.routes) {
      const method = stringifyHttpMethods(route.method);
      const path = route.splitPath ? "/" + route.splitPath.join("/") : "/";
      const key = `${method}:${path}`;

      // Skip duplicates
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      // Skip middleware routes unless requested
      if (!includeMiddleware && this.isMiddlewareRoute(route)) {
        continue;
      }

      result.push({ method, path });
    }

    return result;
  }

  /**
   * Returns structured route definitions with path parameter info, middleware chains,
   * handler names, and optional performance stats.
   *
   * Unlike `getRoutes()` which returns plain method/path pairs, this returns rich
   * metadata suitable for Swagger/OpenAPI generation, API documentation, or tooling.
   * Duplicate method+path combinations are deduplicated.
   *
   * @example
   * ```ts
   * const defs = router.getRouteDefinitions()
   * for (const def of defs) {
   *   // def.method   → "GET"
   *   // def.path     → "/users/:id"
   *   // def.pathParams → [{ name: "id", type: "named", position: 1 }]
   * }
   * ```
   *
   * With source code (for AI/docs):
   * ```ts
   * const defs = router.getRouteDefinitions(undefined, { source: true })
   * // def.source → "async ({ res }) => { ... }"
   * ```
   */
  getRouteDefinitions(
    queryParamMeta?: Map<string, { queryParams?: QueryParamInfo[] }>,
    options?: { source?: boolean },
  ): RouteDefinition[] {
    return getDefs(this.routes, queryParamMeta ?? this.routeMeta, options);
  }

  /**
   * Returns the typed route collection for type inference.
   * Use with InferRoutes and GetReturnType to extract response types.
   *
   * @example
   * ```ts
   * const router = new Router()
   *     .get("/users", () => [{ id: 1, name: "Alice" }])
   *
   * type Routes = typeof router.getTypedRoutes()
   * type UsersResponse = GetReturnType<typeof router, "GET", "/users">
   * ```
   */
  getTypedRoutes(): T {
    return this._typedRoutes as unknown as T;
  }

  /**
   * Attach metadata (query params, descriptions) to a route path.
   * The metadata is included in `getRouteDefinitions()` output and is
   * used for Swagger/OpenAPI generation or API documentation tooling.
   *
   * Query params are **declarative metadata only** — they don't affect routing.
   * At runtime, ANY query string is accepted; use `req.queryParam()` to read them.
   *
   * @param path The route path (e.g. "/search")
   * @param meta Metadata describing the route's expected query parameters
   *
   * @example
   * ```ts
   * router.get("/search", handlerName("search", handler))
   * router.describe("/search", {
   *   queryParams: [
   *     { name: "q",        type: "string",  required: true,  description: "Search query" },
   *     { name: "limit",    type: "integer", required: false, default: 20 },
   *     { name: "category", type: "string",  required: false, enum: ["tech", "design"] },
   *   ]
   * })
   * // getRouteDefinitions() → queryParams populated with metadata
   * ```
   */
  describe(path: string, meta: { queryParams?: QueryParamInfo[] }): this {
    this.routeMeta.set(path, { ...meta });
    return this;
  }

  private isMiddlewareRoute(route: EndpointRoute): boolean {
    // Check if route has middlewareName set
    if (route.middlewareName) {
      return true;
    }

    // Check if it's a merged middleware containing middleware
    if (isMergedRequestMiddleware(route.handler)) {
      const base = (route.handler as MergedRequestMiddleware).base;
      for (const m of base) {
        // Check if any base handler has a middlewareName in its route
        // We can't directly access route from here, so check handler name patterns
        const name = m.name || "";
        if (name.endsWith("Middleware") || name.endsWith("middleware")) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * This function can be used as fetch handler for bun.serve.
   * It will route a request to the correct handler based on the request's method and path.
   * @param request A bun request object
   * @param server A bun server object
   * @returns Bun response, void or a promise of response or void
   */
  handle: BunRequestHandler = (request, server) => {
    try {
      const result = innerHandle(this.routes, request, server);
      if (result && result instanceof Promise) {
        return (result as Promise<Response>).catch((err: Error) => {
          if (this.errorHandler) {
            const res = new ResponseBuilder();
            const ctx = { req: request, res } as Context;
            const p = this.errorHandler(err, ctx);
            if (p && p instanceof Promise) {
              return (p as Promise<void>).then(() => res.build());
            }
            return res.build();
          }
          return new Response("Internal Server Error", {
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          });
        });
      }
      return result as Response;
    } catch (err) {
      if (this.errorHandler) {
        const res = new ResponseBuilder();
        const ctx = { req: request, res } as Context;
        const p = this.errorHandler(err as Error, ctx);
        if (p && p instanceof Promise) {
          return (p as Promise<void>).then(() => res.build());
        }
        return res.build();
      }
      return new Response("Internal Server Error", {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      });
    }
  };

  /**
   * Send a request directly to the router without an HTTP server.
   * Useful for testing.
   * @param request A Request object, or a URL string.
   * @param options RequestInit options if the first param is a string.
   * @returns A promise of the Response object returned by the handler.
   */
  request(
    request: globalThis.Request | string,
    options?: RequestInit,
  ): Promise<Response> {
    let req: globalThis.Request;
    if (typeof request === "string") {
      // Handle relative URLs by prepending default base
      const url = request.startsWith("/")
        ? `http://localhost${request}`
        : request;
      req = new globalThis.Request(url, options);
    } else {
      req = request;
    }
    const res = this.handle(
      req as unknown as Request,
      {
        requestIP: () => ({ address: "127.0.0.1", family: "IPv4", port: 0 }),
      } as unknown as Server<WebSocketData>,
    );
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
  ): Router<T> {
    registerUse(
      this.routes,
      this.mergeHandlers,
      method,
      path,
      handler,
      ...handlers,
    );
    return this;
  }

  /**
   * Registers a route for the `GET` HTTP method.
   * @param path The route path.
   * @param handler The handler function for the route.
   * @param handlers Additional middleware functions to apply to the route.
   * @returns The router instance.
   */
  get<Path extends string, Body>(
    path: Path,
    handler: Handler<Body>,
    ...handlers: RequestMiddleware[]
  ): Router<AppendRoute<T, "GET", Path, Body>> {
    const wrappedHandler: RequestMiddleware = async (ctx) => {
      const result = await (handler as Handler<unknown>)(ctx);
      if (result !== undefined && result !== null) {
        ctx.res.json(result);
      }
    };
    registerGet(
      this.routes,
      this.mergeHandlers,
      path,
      wrappedHandler,
      ...handlers,
    );
    this._typedRoutes = [
      ...this._typedRoutes,
      { method: "GET", path, handler },
    ];
    return this as unknown as Router<AppendRoute<T, "GET", Path, Body>>;
  }

  /**
   * Register a handler to run on incoming POST requests.
   * @param path The path to run the handler on
   * @param handler The handler(s) to run
   * @returns The router
   */
  post<Path extends string, Body>(
    path: Path,
    handler: Handler<Body>,
    ...handlers: RequestMiddleware[]
  ): Router<AppendRoute<T, "POST", Path, Body>> {
    const wrappedHandler: RequestMiddleware = async (ctx) => {
      const result = await (handler as Handler<unknown>)(ctx);
      if (result !== undefined && result !== null) {
        ctx.res.json(result);
      }
    };
    registerPost(
      this.routes,
      this.mergeHandlers,
      path,
      wrappedHandler,
      ...handlers,
    );
    this._typedRoutes = [
      ...this._typedRoutes,
      { method: "POST", path, handler },
    ];
    return this as unknown as Router<AppendRoute<T, "POST", Path, Body>>;
  }

  /**
   * Register a PUT route.
   * @param path The path to match.
   * @param handler The handler for the route.
   * @param handlers Additional handlers to run before the main handler.
   * @returns The Router instance.
   */
  put<Path extends string, Body>(
    path: Path,
    handler: Handler<Body>,
    ...handlers: RequestMiddleware[]
  ): Router<AppendRoute<T, "PUT", Path, Body>> {
    const wrappedHandler: RequestMiddleware = async (ctx) => {
      const result = await (handler as Handler<unknown>)(ctx);
      if (result !== undefined && result !== null) {
        ctx.res.json(result);
      }
    };
    registerPut(
      this.routes,
      this.mergeHandlers,
      path,
      wrappedHandler,
      ...handlers,
    );
    this._typedRoutes = [
      ...this._typedRoutes,
      { method: "PUT", path, handler },
    ];
    return this as unknown as Router<AppendRoute<T, "PUT", Path, Body>>;
  }

  /**
   * Register a middleware function to handle DELETE requests to `path`.
   * @param path The path to register the handler for.
   * @param handler The middleware function to call.
   * @param handlers Additional middleware functions to call.
   * @returns this
   */
  delete<Path extends string, Body>(
    path: Path,
    handler: Handler<Body>,
    ...handlers: RequestMiddleware[]
  ): Router<AppendRoute<T, "DELETE", Path, Body>> {
    const wrappedHandler: RequestMiddleware = async (ctx) => {
      const result = await (handler as Handler<unknown>)(ctx);
      if (result !== undefined && result !== null) {
        ctx.res.json(result);
      }
    };
    registerDelete(
      this.routes,
      this.mergeHandlers,
      path,
      wrappedHandler,
      ...handlers,
    );
    this._typedRoutes = [
      ...this._typedRoutes,
      { method: "DELETE", path, handler },
    ];
    return this as unknown as Router<AppendRoute<T, "DELETE", Path, Body>>;
  }

  /**
   * Register a middleware function to handle PATCH requests to `path`.
   * @param path The path to register the handler for.
   * @param handler The middleware function to call.
   * @param handlers Additional middleware functions to call.
   * @returns this
   */
  patch<Path extends string, Body>(
    path: Path,
    handler: Handler<Body>,
    ...handlers: RequestMiddleware[]
  ): Router<AppendRoute<T, "PATCH", Path, Body>> {
    const wrappedHandler: RequestMiddleware = async (ctx) => {
      const result = await (handler as Handler<unknown>)(ctx);
      if (result !== undefined && result !== null) {
        ctx.res.json(result);
      }
    };
    registerPatch(
      this.routes,
      this.mergeHandlers,
      path,
      wrappedHandler,
      ...handlers,
    );
    this._typedRoutes = [
      ...this._typedRoutes,
      { method: "PATCH", path, handler },
    ];
    return this as unknown as Router<AppendRoute<T, "PATCH", Path, Body>>;
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
  ): Router<T> {
    registerTrace(this.routes, this.mergeHandlers, path, handler, ...handlers);
    return this;
  }

  head(
    path: string,
    handler: RequestMiddleware,
    ...handlers: RequestMiddleware[]
  ): Router<T> {
    registerHead(this.routes, this.mergeHandlers, path, handler, ...handlers);
    return this;
  }

  connect(
    path: string,
    handler: RequestMiddleware,
    ...handlers: RequestMiddleware[]
  ): Router<T> {
    registerConnect(
      this.routes,
      this.mergeHandlers,
      path,
      handler,
      ...handlers,
    );
    return this;
  }

  options(
    path: string,
    handler: RequestMiddleware,
    ...handlers: RequestMiddleware[]
  ): Router<T> {
    registerOptions(
      this.routes,
      this.mergeHandlers,
      path,
      handler,
      ...handlers,
    );
    return this;
  }

  ws(path: string): Router<T> {
    registerWs(this.routes, path);
    return this;
  }

  setWebSocketHandlers(
    handlers: Bun.WebSocketHandler<WebSocketData>,
  ): Router<T> {
    this.wsHandlers = handlers;
    return this;
  }

  onError(handler: ErrorHandler): Router<T> {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Get the WebSocket handlers for Bun.serve.
   * @returns The WebSocket handlers, or undefined if not set.
   */
  getWebSocketHandlers(): Bun.WebSocketHandler<WebSocketData> | undefined {
    return this.wsHandlers;
  }

  redirect(
    method: "*" | HttpMethodString,
    path: string,
    redirectTarget: string,
    perma: boolean = false,
  ): Router<T> {
    registerRedirect(this.routes, method, path, redirectTarget, perma);
    return this;
  }

  static(
    path: string,
    targetDir: string,
    indexFile: string = "index.html",
    deepestLevel: number = 10,
  ): Router<T> {
    registerStatic(this.routes, path, targetDir, indexFile, deepestLevel);
    return this;
  }

  /**
   * Register a unified static file serving mount rooted at `options.root`.
   * Replaces multiple `static()` calls and the separate `GET /` index handler
   * with a single route entry.
   *
   * @param options ServeStatic options
   * @returns The router
   *
   * @example
   * ```ts
   * router.serveStatic({
   *   root: import.meta.dir + "/public",
   *   index: "index.html",
   *   spa: true,
   *   dev: true, // transpile .ts/.tsx and rewrite imports
   * })
   * ```
   */
  serveStatic(options: ServeStaticOptions): Router<T> {
    registerServeStatic(this.routes, options);
    return this;
  }

  cookies(
    method: "*" | HttpMethodString,
    path: string,
    autoResponseHeaders: boolean = false,
  ): Router<T> {
    registerCookies(this.routes, method, path, autoResponseHeaders);
    return this;
  }

  cors(
    method: "*" | HttpMethodString,
    path: string,
    options?: CorsOptions,
  ): Router<T> {
    registerCors(this.routes, method, path, options);
    return this;
  }

  body(
    method: "*" | HttpMethodString,
    path: string,
    options?: BodyParserOptions,
  ): Router<T> {
    registerBodyParser(this.routes, method, path, options);
    return this;
  }

  rateLimit(
    method: "*" | HttpMethodString,
    path: string,
    options: RateLimitOptions,
  ): Router<T> {
    registerRateLimit(this.routes, method, path, options);
    return this;
  }

  requestId(
    method: "*" | HttpMethodString,
    path: string,
    options?: RequestIdOptions,
  ): Router<T> {
    registerRequestId(this.routes, method, path, options);
    return this;
  }

  timeout(
    method: "*" | HttpMethodString,
    path: string,
    options: TimeoutOptions,
  ): Router<T> {
    registerTimeout(this.routes, method, path, options);
    return this;
  }

  fileUpload(
    method: "*" | HttpMethodString,
    path: string,
    options?: FileUploadOptions,
  ): Router<T> {
    registerFileUpload(this.routes, method, path, options);
    return this;
  }

  /**
   * Get a single uploaded file from the request.
   * @param req The request object
   * @param fieldName The form field name
   * @returns The first uploaded file, or undefined
   */
  static getFile = getFile;

  /**
   * Get all uploaded files for a field name from the request.
   * @param req The request object
   * @param fieldName The form field name
   * @returns Array of uploaded files, or empty array
   */
  static getFiles = getFiles;

  /**
   * Get all uploaded field names from the request.
   * @param req The request object
   * @returns Array of field names that have files
   */
  static getFileFieldNames = getFileFieldNames;

  /**
   * Get all parsed form fields (non-file) from the request.
   * @param req The request object
   * @returns Record of field names to values
   */
  static getFormFields = getFormFields;

  /**
   * Create a route group with a common prefix path.
   * All routes registered via the callback will be prefixed with the given path.
   * @param prefix The prefix path for all routes in the group
   * @param callback A function that receives the router to register routes on
   * @returns The router, for chaining
   */
  group(prefix: string, callback: (router: Router<T>) => void): Router<T> {
    const subRouter = new Router<T>();
    callback(subRouter);

    for (const route of subRouter.routes) {
      const mergedSplitPath = this.mergeSplitPaths(
        splitRoutePath(prefix),
        route.splitPath,
      );
      this.routes.push({
        ...route,
        splitPath: mergedSplitPath,
      });
    }

    return this;
  }

  mount(prefix: string, subRouter: Router): Router<T> {
    for (const route of subRouter.routes) {
      const mergedSplitPath = this.mergeSplitPaths(
        splitRoutePath(prefix),
        route.splitPath,
      );
      this.routes.push({
        ...route,
        splitPath: mergedSplitPath,
      });
    }
    return this;
  }

  private mergeSplitPaths(
    prefix: ReturnType<typeof splitRoutePath>,
    suffix: ReturnType<typeof splitRoutePath>,
  ): ReturnType<typeof splitRoutePath> {
    if (!prefix && !suffix) {
      return undefined;
    }
    if (!prefix) {
      return suffix;
    }
    if (!suffix) {
      return prefix;
    }
    return [...prefix, ...suffix] as ReturnType<typeof splitRoutePath>;
  }
}
