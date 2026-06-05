import type { Context, RequestMiddleware } from "./types"
import { splitRoutePath } from "./path"
import { parseHttpMethods, HttpMethodString } from "./method"
import { isMergeableEndpointRoute, mergeRequestMiddlewares } from "./middleware"
import type { EndpointRoute } from "./types"
import { Router } from "./router"

export type Handler<T> = (ctx: Context) => T | Promise<T>

export interface Route<T = unknown> {
    method: string
    path: string
    handler: Handler<T>
}

export type RouteCollection = Route[]

type AppendRoute<
    T extends RouteCollection,
    Method extends string,
    Path extends string,
    Body
> = [...T, { method: Method; path: Path; handler: Handler<Body> }]

type GetRoute<
    T extends RouteCollection,
    Method extends string,
    Path extends string
> = T extends [infer First, ...infer Rest]
    ? First extends { method: Method; path: Path; handler: Handler<infer Body> }
        ? Body
        : Rest extends RouteCollection
        ? GetRoute<Rest, Method, Path>
        : never
    : never

export class TypedRouter<T extends RouteCollection = []> {
    private routes: T = [] as unknown as T
    private router: Router = new Router()

    get<Path extends string, Body>(
        path: Path,
        handler: Handler<Body>,
        ...middleware: RequestMiddleware[]
    ): TypedRouter<AppendRoute<T, "GET", Path, Body>> {
        const typedRouter = new TypedRouter<AppendRoute<T, "GET", Path, Body>>()
        typedRouter.routes = [...this.routes, { method: "GET", path, handler }] as unknown as AppendRoute<T, "GET", Path, Body>
        typedRouter.router = this.router
        typedRouter.router.get(path, async (ctx) => {
            const result = await handler(ctx)
            ctx.res.json(result)
        }, ...middleware)
        return typedRouter
    }

    post<Path extends string, Body>(
        path: Path,
        handler: Handler<Body>,
        ...middleware: RequestMiddleware[]
    ): TypedRouter<AppendRoute<T, "POST", Path, Body>> {
        const typedRouter = new TypedRouter<AppendRoute<T, "POST", Path, Body>>()
        typedRouter.routes = [...this.routes, { method: "POST", path, handler }] as unknown as AppendRoute<T, "POST", Path, Body>
        typedRouter.router = this.router
        typedRouter.router.post(path, async (ctx) => {
            const result = await handler(ctx)
            ctx.res.json(result)
        }, ...middleware)
        return typedRouter
    }

    put<Path extends string, Body>(
        path: Path,
        handler: Handler<Body>,
        ...middleware: RequestMiddleware[]
    ): TypedRouter<AppendRoute<T, "PUT", Path, Body>> {
        const typedRouter = new TypedRouter<AppendRoute<T, "PUT", Path, Body>>()
        typedRouter.routes = [...this.routes, { method: "PUT", path, handler }] as unknown as AppendRoute<T, "PUT", Path, Body>
        typedRouter.router = this.router
        typedRouter.router.put(path, async (ctx) => {
            const result = await handler(ctx)
            ctx.res.json(result)
        }, ...middleware)
        return typedRouter
    }

    delete<Path extends string, Body>(
        path: Path,
        handler: Handler<Body>,
        ...middleware: RequestMiddleware[]
    ): TypedRouter<AppendRoute<T, "DELETE", Path, Body>> {
        const typedRouter = new TypedRouter<AppendRoute<T, "DELETE", Path, Body>>()
        typedRouter.routes = [...this.routes, { method: "DELETE", path, handler }] as unknown as AppendRoute<T, "DELETE", Path, Body>
        typedRouter.router = this.router
        typedRouter.router.delete(path, async (ctx) => {
            const result = await handler(ctx)
            ctx.res.json(result)
        }, ...middleware)
        return typedRouter
    }

    patch<Path extends string, Body>(
        path: Path,
        handler: Handler<Body>,
        ...middleware: RequestMiddleware[]
    ): TypedRouter<AppendRoute<T, "PATCH", Path, Body>> {
        const typedRouter = new TypedRouter<AppendRoute<T, "PATCH", Path, Body>>()
        typedRouter.routes = [...this.routes, { method: "PATCH", path, handler }] as unknown as AppendRoute<T, "PATCH", Path, Body>
        typedRouter.router = this.router
        typedRouter.router.patch(path, async (ctx) => {
            const result = await handler(ctx)
            ctx.res.json(result)
        }, ...middleware)
        return typedRouter
    }

    getRoutes(): T {
        return this.routes
    }

    getRouter(): Router {
        return this.router
    }

    get handle() {
        return this.router.handle
    }
}

export type InferRoutes<R extends TypedRouter<any>> = R extends TypedRouter<infer T> ? T : never

export type GetReturnType<
    R extends TypedRouter<any>,
    Method extends string,
    Path extends string
> = GetRoute<InferRoutes<R>, Method, Path>
