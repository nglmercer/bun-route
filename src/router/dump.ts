import type { Server } from "bun"
import type { EndpointRoute } from "../types"
import { stringifyHttpMethods } from "../method"
import { isMergedRequestMiddleware, unmergeRequestMiddleware } from "../middleware"
import type { RequestMiddleware, WebSocketData } from "../types"

/**
 * Creates a string tuple that contains the method, path and name of the middleware
 * @param route The route to generate the string for
 * @param handler The handler of the route
 * @param mergedToTop Whether the handler is merged to the top
 * @returns A string with 3 parts: method, path and name
 */
export function getDefinitionString(
    route: EndpointRoute,
    handler: RequestMiddleware,
    mergedToTop: boolean,
): [string, string, string] {
    let parts: [string, string, string] = ["/", "X", "/"]

    if (mergedToTop) {
        parts[0] = "^ (M)"
    } else {
        parts[0] = stringifyHttpMethods(route.method)
    }

    if (route.splitPath) {
        parts[1] = "/" + route.splitPath.join("/")
    } else {
        parts[1] = "/"
    }

    if (
        isMergedRequestMiddleware(handler)
    ) {
        parts[2] = "[merged]"
    } else if (
        handler &&
        typeof handler.name == "string" &&
        handler.name.length != 0
    ) {
        parts[2] = handler.name
    } else if (
        handler &&
        handler.prototype &&
        typeof handler.prototype.name == "string" &&
        handler.prototype.name.length != 0
    ) {
        parts[2] = handler.prototype.name
    } else {
        parts[2] = "[anonym]"
    }

    return parts
}

/**
 * Prints a table of all endpoints defined in the router.
 * 
 * If a server is given as a parameter, a running message with the url of the server is printed too.
 * @param routes The routes to dump
 * @param servers The server to print the url of
 * @returns A string representing the table of endpoints
 */
export function dump(
    routes: EndpointRoute[],
    ...servers: Server<WebSocketData>[]
): string {
    if (routes.length == 0) {
        throw new Error("No endpoint routes defined")
    }

    let unmergedParts: [string, string, string][] = []
    let mergedParts: [string, string, string][] = []
    for (const route of routes) {
        mergedParts.push(
            getDefinitionString(
                route,
                route.handler,
                false
            )
        )

        unmergedParts.push(
            ...unmergeRequestMiddleware(route.handler)
                .map(
                    (middleware, index) => getDefinitionString(
                        route,
                        middleware,
                        index != 0,
                    )
                )
        )
    }

    const both = [
        ...unmergedParts,
        ...mergedParts
    ]
    const part1MinLen = both.sort(
        (a, b) => b[0].length - a[0].length
    )[0][0].length
    const part2MinLen = both.sort(
        (a, b) => b[1].length - a[1].length
    )[0][1].length
    const part3MinLen = both.sort(
        (a, b) => b[2].length - a[2].length
    )[0][2].length

    const lines: string[] = []

    if (servers && servers.length != 0) {
        if (servers.length == 1) {
            lines.push("Server is listening on " + servers[0].url)
        } else {
            lines.push("Server is listening on:")
            lines.push(
                ...servers.map(
                    (server) => "- " + server.url
                )
            )
        }
    }

    lines.push(
        "",
        "# Defined endpoints:",
        ...unmergedParts.map(
            ([part1, part2, part3]): string =>
                "| " + part1.padEnd(part1MinLen) +
                " | " + part2.padEnd(part2MinLen) +
                " | " + part3.padEnd(part3MinLen) +
                " |"
        ),
        "",
    )

    if (unmergedParts.length != mergedParts.length) {
        lines.push(
            "# Merged endpoints:",
            ...mergedParts.map(
                ([part1, part2, part3]): string =>
                    "| " + part1.padEnd(part1MinLen) +
                    " | " + part2.padEnd(part2MinLen) +
                    " | " + part3.padEnd(part3MinLen) +
                    " |"
            ),
            "",
        )
    }

    return lines.join("\n")
}
