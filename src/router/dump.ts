import type { Server } from "bun"
import type { EndpointRoute } from "../types"
import { stringifyHttpMethods } from "../method"
import { isMergedRequestMiddleware, unmergeRequestMiddleware } from "../middleware"
import { PATH_CHARS, ROUTE_TOKENS, isNamedParam, getNamedParamName } from "../path"
import type { RequestMiddleware, WebSocketData } from "../types"

export interface RouteStats {
    requestCount: number
    totalTimeMs: number
    avgTimeMs: number
}

const routeStats = new Map<string, RouteStats>()

export function trackRouteTime(
    method: string,
    path: string,
    timeMs: number,
): void {
    const key = `${method}:${path}`
    let stats = routeStats.get(key)
    if (!stats) {
        stats = { requestCount: 0, totalTimeMs: 0, avgTimeMs: 0 }
        routeStats.set(key, stats)
    }
    stats.requestCount++
    stats.totalTimeMs += timeMs
    stats.avgTimeMs = stats.totalTimeMs / stats.requestCount
}

export function getRouteStats(): Map<string, RouteStats> {
    return routeStats
}

export function clearRouteStats(): void {
    routeStats.clear()
}

export type RouteParamType = "named" | "wildcard" | "double-wildcard"

export interface RouteParamInfo {
    name: string
    type: RouteParamType
    position: number
}

export interface MiddlewareInfo {
    name: string
    mergedToTop: boolean
}

export interface QueryParamInfo {
    name: string
    type: "string" | "number" | "integer" | "boolean" | "array"
    required: boolean
    description?: string
    default?: unknown
    enum?: string[]
}

export interface RouteDefinition {
    method: string
    path: string
    splitPath: string[]
    pathParams: RouteParamInfo[]
    handlerName: string
    middlewareName?: string
    middlewareChain: MiddlewareInfo[]
    isMerged: boolean
    stats?: RouteStats
    queryParams?: QueryParamInfo[]
}

export interface DumpOptions {
    format?: "table" | "compact" | "json"
    customFormatter?: (
        definitions: RouteDefinition[],
        servers: Server<WebSocketData>[]
    ) => string
}

export function extractPathParams(splitPath: string[] | undefined): RouteParamInfo[] {
    if (!splitPath) return []
    const params: RouteParamInfo[] = []
    let wildcardIndex = 0
    for (let i = 0; i < splitPath.length; i++) {
        const segment = splitPath[i]
        if (isNamedParam(segment)) {
            params.push({ name: getNamedParamName(segment), type: "named", position: i })
        } else if (segment === ROUTE_TOKENS.WILDCARD) {
            params.push({ name: `_${wildcardIndex++}`, type: "wildcard", position: i })
        } else if (segment === ROUTE_TOKENS.DOUBLE_WILDCARD) {
            params.push({ name: "wild", type: "double-wildcard", position: i })
        }
    }
    return params
}

export function resolveHandlerName(handler: RequestMiddleware): string {
    if (isMergedRequestMiddleware(handler)) {
        return "[merged]"
    }
    if (handler && typeof handler.name === "string" && handler.name.length > 0) {
        if (handler.name !== "handler") return handler.name
    }
    if (handler && handler.prototype && typeof handler.prototype.name === "string" && handler.prototype.name.length > 0) {
        return handler.prototype.name
    }
    const middlewareName = (handler as unknown as Record<string, unknown>).middlewareName
    if (typeof middlewareName === "string" && middlewareName.length > 0) {
        return middlewareName
    }
    return "[anonym]"
}

export function getRouteDefinitions(
    routes: EndpointRoute[],
    routeMeta?: Map<string, { queryParams?: QueryParamInfo[] }>,
): RouteDefinition[] {
    const seen = new Set<string>()
    const definitions: RouteDefinition[] = []

    for (const route of routes) {
        const method = stringifyHttpMethods(route.method)
        const splitPath = route.splitPath ?? []
        const path = splitPath.length > 0 ? "/" + splitPath.join("/") : "/"
        const key = `${method}:${path}`

        if (seen.has(key)) continue
        seen.add(key)

        const pathParams = extractPathParams(splitPath)
        const middlewares = unmergeRequestMiddleware(route.handler)
        const handlerName = resolveHandlerName(route.handler)
        const isMerged = isMergedRequestMiddleware(route.handler)

        const middlewareChain: MiddlewareInfo[] = middlewares.map((m, i) => ({
            name: resolveHandlerName(m),
            mergedToTop: isMerged && i !== middlewares.length - 1,
        }))

        const statsKey = `${method}:${path}`
        const stats = routeStats.get(statsKey)

        const meta = routeMeta?.get(path)

        const def: RouteDefinition & { toJSON?(): Record<string, unknown> } = {
            method,
            path,
            splitPath,
            pathParams,
            handlerName,
            middlewareName: route.middlewareName,
            middlewareChain,
            isMerged,
            stats: stats ? { ...stats } : undefined,
            queryParams: meta?.queryParams,
        }

        def.toJSON = function (this: RouteDefinition) {
            const base: Record<string, unknown> = {
                method: this.method,
                path: this.path,
                splitPath: this.splitPath,
                pathParams: this.pathParams.map(p => ({ name: p.name, type: p.type, position: p.position })),
                handlerName: this.handlerName,
                middlewareName: this.middlewareName,
                middlewareChain: this.middlewareChain.map(m => ({ name: m.name, mergedToTop: m.mergedToTop })),
                isMerged: this.isMerged,
                stats: this.stats ? { ...this.stats } : undefined,
            }
            if (this.queryParams) {
                base.queryParams = this.queryParams
            }
            return base
        }

        definitions.push(def)
    }

    return definitions
}

export function getDefinitionString(
    route: EndpointRoute,
    handler: RequestMiddleware,
    mergedToTop: boolean,
): [string, string, string] {
    let parts: [string, string, string] = [PATH_CHARS.SLASH, "X", PATH_CHARS.SLASH]

    if (mergedToTop) {
        parts[0] = "^ (M)"
    } else {
        parts[0] = stringifyHttpMethods(route.method)
    }

    if (route.splitPath) {
        parts[1] = PATH_CHARS.SLASH + route.splitPath.join(PATH_CHARS.SLASH)
    } else {
        parts[1] = PATH_CHARS.SLASH
    }

    parts[2] = resolveHandlerName(handler)

    return parts
}

function isServer(obj: unknown): obj is Server<WebSocketData> {
    return typeof obj === "object" && obj !== null && "url" in obj
}

const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"]

function methodSortIndex(method: string): number {
    const idx = METHOD_ORDER.indexOf(method)
    return idx === -1 ? 99 : idx
}

function buildHandlerString(def: RouteDefinition, hasStats: boolean): string {
    const chain = def.middlewareChain.map(m => m.name).join(" → ")
    const countPrefix = def.middlewareChain.length > 1 ? `[${def.middlewareChain.length}] ` : ""
    const statsStr = hasStats && def.stats
        ? ` (${def.stats.requestCount} req, ${def.stats.avgTimeMs.toFixed(2)}ms)`
        : ""
    return countPrefix + chain + statsStr
}

export function dump(
    routes: EndpointRoute[],
    optionsOrServer?: DumpOptions | Server<WebSocketData>,
    ...servers: Server<WebSocketData>[]
): string {
    if (routes.length == 0) {
        throw new Error("No endpoint routes defined")
    }

    let options: DumpOptions = {}
    let allServers: Server<WebSocketData>[] = []

    if (optionsOrServer !== undefined) {
        if (isServer(optionsOrServer)) {
            allServers = [optionsOrServer, ...servers]
        } else {
            options = optionsOrServer
            allServers = servers
        }
    }

    const definitions = getRouteDefinitions(routes)

    if (options.customFormatter) {
        return options.customFormatter(definitions, allServers)
    }

    definitions.sort((a, b) => {
        const pathCompare = a.path.localeCompare(b.path)
        if (pathCompare !== 0) return pathCompare
        return methodSortIndex(a.method) - methodSortIndex(b.method)
    })

    const hasStats = routeStats.size > 0
    const withMiddlewareCount = definitions.filter(d => d.middlewareChain.length > 1).length
    const totalRoutes = definitions.length

    const lines: string[] = []

    if (allServers.length > 0) {
        if (allServers.length == 1) {
            lines.push("Server is listening on " + allServers[0].url)
        } else {
            lines.push("Server is listening on:")
            lines.push(...allServers.map(s => "- " + s.url))
        }
    }

    const middlewareInfo = withMiddlewareCount > 0 ? ` (${withMiddlewareCount} with middleware)` : ""
    lines.push(`# ${totalRoutes} endpoint${totalRoutes !== 1 ? "s" : ""}${middlewareInfo}`)

    if (options.format === "json") {
        lines.push(JSON.stringify(definitions.map(d => (d as RouteDefinition & { toJSON(): Record<string, unknown> }).toJSON()), null, 2))
        return lines.join("\n")
    }

    if (options.format === "compact") {
        const methodWidth = Math.max(6, ...definitions.map(d => d.method.length))
        const pathWidth = Math.max(4, ...definitions.map(d => d.path.length))
        for (const def of definitions) {
            const handlerStr = buildHandlerString(def, hasStats)
            lines.push(`${def.method.padEnd(methodWidth)} ${def.path.padEnd(pathWidth)} ${handlerStr}`)
        }
        return lines.join("\n")
    }

    const methodWidth = Math.max("Method".length, ...definitions.map(d => d.method.length))
    const pathWidth = Math.max("Path".length, ...definitions.map(d => d.path.length))
    const handlerWidth = Math.max("Handlers".length, ...definitions.map(d => buildHandlerString(d, hasStats).length))

    const header = `| ${"Method".padEnd(methodWidth)} | ${"Path".padEnd(pathWidth)} | ${"Handlers".padEnd(handlerWidth)} |`
    const separator = `| ${"-".repeat(methodWidth)} | ${"-".repeat(pathWidth)} | ${"-".repeat(handlerWidth)} |`

    lines.push("", header, separator)

    for (const def of definitions) {
        const handlerStr = buildHandlerString(def, hasStats)
        lines.push(`| ${def.method.padEnd(methodWidth)} | ${def.path.padEnd(pathWidth)} | ${handlerStr.padEnd(handlerWidth)} |`)
    }

    lines.push("")

    return lines.join("\n")
}
