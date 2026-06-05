import type { Context } from "./types"

export type Handler<T> = (ctx: Context) => T | Promise<T>

export interface Route<T = unknown> {
    method: string
    path: string
    handler: Handler<T>
}

export type RouteCollection = Route[]

export type AppendRoute<
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

export type InferRoutes<R> = R extends { getTypedRoutes(): infer T extends RouteCollection } ? T : []

export type GetReturnType<
    R,
    Method extends string,
    Path extends string
> = GetRoute<InferRoutes<R>, Method, Path>
