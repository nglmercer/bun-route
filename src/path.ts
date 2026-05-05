export type SplitPath = [string, ...string[]] | undefined

/**
 * Trims leading and trailing whitespace characters from a string.
 * @param {string} value - The input string to be trimmed.
 * @return {string} The trimmed string.
 */
export function trimSpaces(value: string): string {
    while (
        value.startsWith(" ") ||
        value.startsWith("\t") ||
        value.startsWith("\n")
    ) {
        value = value.slice(1)
    }

    if (value.length == 0) {
        return ""
    }

    while (
        value.endsWith(" ") ||
        value.endsWith("\t") ||
        value.endsWith("\n")
    ) {
        value = value.slice(0, -1)
    }

    return value
}

/**
 * Splits a path into its components.
 * @param path The path to split.
 * @returns An array of strings representing the path components.
 *          undefined if the path is empty.
 */
export function splitPath(path: string | undefined): SplitPath {
    if (path == undefined) {
        return undefined
    }

    while (
        path.startsWith("/") ||
        path.startsWith(" ")
    ) {
        path = path.slice(1)
    }

    if (path.length == 0) {
        return undefined
    }

    while (
        path.endsWith("/") ||
        path.endsWith(" ")
    ) {
        path = path.slice(0, -1)
    }

    const splitPath = path
        .split("/")
        .map((part) => {
            while (
                part.startsWith("/") ||
                part.startsWith(" ")
            ) {
                part = part.slice(1)
            }

            if (part.length == 0) {
                return ""
            }

            while (
                part.endsWith("/") ||
                part.endsWith(" ")
            ) {
                part = part.slice(0, -1)
            }

            return part
        })
        .filter((v) => v.length != 0)
    if (splitPath.length == 0) {
        return undefined
    }

    return splitPath as SplitPath
}

export function splitRoutePath(path: string | undefined): SplitPath {
    const splittedPath = splitPath(path)

    if (
        splittedPath &&
        splittedPath.length > 1 &&
        splittedPath.slice(0, -1).includes("**")
    ) {
        throw new Error(
            "Invalid router path, ** must be the last part"
        )
    }

    return splittedPath as SplitPath
}

/**
 * Checks if a requested splitpath matches the routes splitpath.
 * Also resolves single (*) and double (** wildcards.
 * `true` or wildcarded path parts are returned if found and match.
 * `false` is returned if not.
 * @param requestPath the path to check
 * @param routeSelector the route selector to check against
 */
export function requestPathMatchesRouteDefinition(
    requestPath: SplitPath,
    routeSelector: SplitPath,
): string[] | boolean {
    if (
        requestPath == undefined &&
        routeSelector == undefined
    ) {
        return []
    } else if (
        routeSelector == undefined
    ) {
        return false
    } else if (
        requestPath == undefined
    ) {
        if (routeSelector[0] == "**") {
            return true
        }
        return false
    } else if (
        requestPath.length == 0
    ) {
        throw new Error("Invalid requestPath SplitPath length, got 0, expected at least 1")
    } else if (
        routeSelector.length == 0
    ) {
        throw new Error("Invalid routeSelector SplitPath length, got 0, expected at least 1")
    } else if (routeSelector[0] == "**") {
        return requestPath
    } else if (routeSelector.length < requestPath.length) {
        if (routeSelector[routeSelector.length - 1] != "**") {
            return false
        }
    }

    let pathParams: string[] | true = true

    for (let i = 0; i < routeSelector.length; i++) {
        switch (routeSelector[i]) {
            case "*":
                if (requestPath.length <= i) {
                    return false
                }
                if (pathParams === true) {
                    pathParams = []
                }
                pathParams.push(requestPath[i])
                break
            case "**":
                if (requestPath.length - i > 0) {
                    if (pathParams === true) {
                        pathParams = []
                    }
                    pathParams.push(...requestPath.slice(i))
                }
                return pathParams
            case requestPath[i]:
                break
            default:
                return false

        }
    }

    return pathParams
}
