import { statSync, existsSync } from "fs"
import { join } from "path"
import { splitRoutePath } from "../path"
import { parseHttpMethods, HttpMethodString } from "../method"
import { PATH_CHARS } from "../path"
import { HTTP_STATUS } from "../responseBuilder"
import { HTTP_HEADERS, CONTENT_TYPES, CACHE_CONTROL } from "../headers"
import type { EndpointRoute, RequestMiddleware, WebSocketData } from "../types"

function generateETag(buffer: ArrayBuffer): string {
    const hash = new Bun.CryptoHasher("md5")
    hash.update(buffer)
    return `"${hash.digest("hex")}"`
}

const transpiler = new Bun.Transpiler({
    loader: "ts",
    target: "browser",
    treeShaking: true,
    deadCodeElimination: true,
    trimUnusedImports: true,
})

const tsxTranspiler = new Bun.Transpiler({
    loader: "tsx",
    target: "browser",
    treeShaking: true,
    deadCodeElimination: true,
    trimUnusedImports: true,
    autoImportJSX: true,
})

function getContentType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase()
    switch (ext) {
        case "ts":
        case "tsx":
        case "js":
        case "jsx":
        case "mjs":
            return CONTENT_TYPES.TEXT_JAVASCRIPT
        case "css":
            return CONTENT_TYPES.TEXT_CSS
        case "html":
        case "htm":
            return CONTENT_TYPES.TEXT_HTML
        case "json":
            return CONTENT_TYPES.APPLICATION_JSON
        case "svg":
            return CONTENT_TYPES.IMAGE_SVG_XML
        case "png":
            return CONTENT_TYPES.IMAGE_PNG
        case "jpg":
        case "jpeg":
            return CONTENT_TYPES.IMAGE_JPEG
        case "gif":
            return CONTENT_TYPES.IMAGE_GIF
        case "webp":
            return CONTENT_TYPES.IMAGE_WEBP
        case "ico":
            return CONTENT_TYPES.IMAGE_ICO
        case "woff":
            return CONTENT_TYPES.FONT_WOFF
        case "woff2":
            return CONTENT_TYPES.FONT_WOFF2
        case "ttf":
            return CONTENT_TYPES.FONT_TTF
        case "pdf":
            return CONTENT_TYPES.APPLICATION_PDF
        case "wasm":
            return CONTENT_TYPES.APPLICATION_WASM
        case "mp4":
            return CONTENT_TYPES.VIDEO_MP4
        case "webm":
            return CONTENT_TYPES.VIDEO_WEBM
        case "mp3":
            return CONTENT_TYPES.AUDIO_MPEG
        case "ogg":
            return CONTENT_TYPES.AUDIO_OGG
        case "wav":
            return CONTENT_TYPES.AUDIO_WAV
        default:
            return CONTENT_TYPES.APPLICATION_OCTET_STREAM
    }
}

async function transpileTypeScript(code: string, filePath: string): Promise<string> {
    const isTsx = filePath.endsWith(".tsx")
    const t = isTsx ? tsxTranspiler : transpiler
    return t.transform(code)
}

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
    const wsMiddleware: RequestMiddleware = (ctx) => {
        const req = ctx.req
        const createdAt = Date.now()
        const data: WebSocketData = {
            createdAt: createdAt,
            channelId: crypto.randomUUID()
        }
        if (req.server.upgrade(req, { data: data })) {
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
        (ctx) => ctx.res.sendRedirect(redirectTarget, perma)

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
    if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
        throw new Error("static target is not a directory: " + targetDir)
    }

    const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"]
    const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx", "index.html"]

    async function resolveFilePath(basePath: string): Promise<string | null> {
        const file = Bun.file(basePath)
        if (await file.exists()) {
            const stat = statSync(basePath)
            if (stat.isFile()) {
                return basePath
            }
            if (stat.isDirectory()) {
                for (const idx of INDEX_FILES) {
                    const indexPath = join(basePath, idx)
                    if (await Bun.file(indexPath).exists()) {
                        return indexPath
                    }
                }
                return null
            }
        }

        for (const ext of RESOLVE_EXTENSIONS) {
            const pathWithExt = basePath + ext
            if (await Bun.file(pathWithExt).exists()) {
                return pathWithExt
            }
        }

        return null
    }

    const staticMiddleware: RequestMiddleware =
        (ctx) => {
            const req = ctx.req
            const res = ctx.res
            if (req.path.endsWith(PATH_CHARS.SLASH + indexFile)) {
                res.sendRedirect(
                    req.path.slice(0, -indexFile.length),
                    true,
                )
                return
            }

            let relativeParts: string[] = []
            if (req.pathParams !== undefined) {
                if (Array.isArray(req.pathParams)) {
                    relativeParts = req.pathParams
                } else if (typeof req.pathParams === "object") {
                    relativeParts = Object.values(req.pathParams)
                } else if (req.pathParams === true) {
                    relativeParts = req.splitPath ? req.splitPath.slice(1) : []
                }
            }

            let targetPath = join(targetDir, ...relativeParts)

            if (targetPath.endsWith(PATH_CHARS.SLASH)) {
                targetPath += indexFile
            }

            if (
                req.splitPath != undefined &&
                req.splitPath?.length > deepestLevel
            ) {

                return
            }

            return resolveFilePath(targetPath).then(async (resolvedPath) => {
                if (!resolvedPath) {
                    res.status(HTTP_STATUS.NOT_FOUND)
                    return
                }

                try {
                    const file = Bun.file(resolvedPath)
                    const buffer = await file.arrayBuffer()
                    const etag = generateETag(buffer)
                    const ifNoneMatch = req.headers.get("if-none-match")

                    if (ifNoneMatch && ifNoneMatch === etag) {
                        res.status(304).send()
                        return
                    }

                    res.setHeader(HTTP_HEADERS.ETAG, etag)
                    res.setHeader(HTTP_HEADERS.CACHE_CONTROL, CACHE_CONTROL.PUBLIC_MAX_AGE_0)
                    
                    const isTypeScript = resolvedPath.endsWith(".ts") || resolvedPath.endsWith(".tsx")
                    const isCSS = resolvedPath.endsWith(".css")
                    
                    if (isTypeScript) {
                        const code = await file.text()
                        const transpiled = await transpileTypeScript(code, resolvedPath)
                        res.setHeader(HTTP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.TEXT_JAVASCRIPT)
                        res.send(transpiled)
                    } else if (isCSS) {
                        const secFetchDest = req.headers.get("sec-fetch-dest")
                        const css = await file.text()

                        if (secFetchDest === "style") {
                            res.setHeader(HTTP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.TEXT_CSS)
                            res.send(css)
                        } else {
                            const escapedCSS = JSON.stringify(css)
                            const jsModule = `const css = ${escapedCSS};\nconst style = document.createElement('style');\nstyle.textContent = css;\ndocument.head.appendChild(style);\nexport default css;\n`
                            res.setHeader(HTTP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.TEXT_JAVASCRIPT)
                            res.send(jsModule)
                        }
                    } else {
                        res.setHeader(HTTP_HEADERS.CONTENT_TYPE, getContentType(resolvedPath))
                        res.send(buffer)
                    }
                } catch (_) {
                    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Error while loading response content")
                }
            }).catch(() => {
                res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Error while resolving file")
            })
        }

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods("GET"),
        handler: staticMiddleware
    })

    return routes
}

export interface DevServerOptions {
    targetDir: string
    indexFile?: string
    deepestLevel?: number
    importMap?: Record<string, string>
    aliases?: Record<string, string>
    define?: Record<string, string>
    tsconfig?: string | Bun.TSConfig
    autoImportJSX?: boolean
    treeShaking?: boolean
    minifyWhitespace?: boolean
}

/**
 * Register a development-style static file serving route with TypeScript transpilation
 * and import rewriting (similar to Vite's dev server).
 * 
 * Features:
 * - Automatic TypeScript/TSX transpilation
 * - Import path rewriting for browser compatibility
 * - Support for import maps and path aliases
 * - Proper content-type detection
 * 
 * @param routes The routes array to add to
 * @param path The path to serve files from (supports wildcards like "/src/**")
 * @param options Dev server options
 * @returns The updated routes array
 */
export function devStatic(
    routes: EndpointRoute[],
    path: string,
    options: DevServerOptions
): EndpointRoute[] {
    const { 
        targetDir, 
        indexFile = "index.html", 
        deepestLevel = 10, 
        importMap = {}, 
        aliases = {},
        define = {},
        tsconfig,
        autoImportJSX = true,
        treeShaking = true,
        minifyWhitespace = false,
    } = options

    if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
        throw new Error("devStatic target is not a directory: " + targetDir)
    }

    const tsTranspiler = new Bun.Transpiler({
        loader: "ts",
        target: "browser",
        treeShaking,
        deadCodeElimination: true,
        trimUnusedImports: true,
        minifyWhitespace,
        define,
        tsconfig,
    })

    const tsxTranspiler = new Bun.Transpiler({
        loader: "tsx",
        target: "browser",
        treeShaking,
        deadCodeElimination: true,
        trimUnusedImports: true,
        minifyWhitespace,
        autoImportJSX,
        define,
        tsconfig,
    })

    async function transpileCode(code: string, filePath: string): Promise<string> {
        const isTsx = filePath.endsWith(".tsx")
        const t = isTsx ? tsxTranspiler : tsTranspiler
        return t.transform(code)
    }

    function rewriteImports(code: string, currentPath: string): string {
        let result = code

        for (const [from, to] of Object.entries(aliases)) {
            const regex = new RegExp(`(from\\s+['"])${from}(/|['"])`, "g")
            result = result.replace(regex, `$1${to}$2`)
        }

        for (const [from, to] of Object.entries(importMap)) {
            const regex = new RegExp(`(from\\s+['"])${from}(/|['"])`, "g")
            result = result.replace(regex, `$1${to}$2`)
        }

        result = result.replace(/(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g, (match, prefix, importPath, suffix) => {
            if (importPath.endsWith(".ts") || importPath.endsWith(".tsx") || importPath.endsWith(".js") || importPath.endsWith(".jsx")) {
                return match
            }
            return `${prefix}${importPath}${suffix}`
        })

        return result
    }

    function rewriteCSSImports(css: string): string {
        let result = css

        for (const [from, to] of Object.entries(aliases)) {
            const regex = new RegExp(`(@import\\s+['"])${from}(/|['"])`, "g")
            result = result.replace(regex, `$1${to}$2`)
        }

        for (const [from, to] of Object.entries(importMap)) {
            const regex = new RegExp(`(@import\\s+['"])${from}(/|['"])`, "g")
            result = result.replace(regex, `$1${to}$2`)
        }

        return result
    }

    const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"]
    const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx"]

    async function resolveFilePath(basePath: string): Promise<string | null> {
        const file = Bun.file(basePath)
        if (await file.exists()) {
            const stat = statSync(basePath)
            if (stat.isFile()) {
                return basePath
            }
            if (stat.isDirectory()) {
                for (const indexFile of INDEX_FILES) {
                    const indexPath = join(basePath, indexFile)
                    if (await Bun.file(indexPath).exists()) {
                        return indexPath
                    }
                }
                return null
            }
        }

        for (const ext of RESOLVE_EXTENSIONS) {
            const pathWithExt = basePath + ext
            if (await Bun.file(pathWithExt).exists()) {
                return pathWithExt
            }
        }

        return null
    }

    const devMiddleware: RequestMiddleware = (ctx) => {
        const req = ctx.req
        const res = ctx.res

        if (req.path.endsWith(PATH_CHARS.SLASH + indexFile)) {
            res.sendRedirect(req.path.slice(0, -indexFile.length), true)
            return
        }

        let relativeParts: string[] = []
        if (req.pathParams !== undefined) {
            if (Array.isArray(req.pathParams)) {
                relativeParts = req.pathParams
            } else if (typeof req.pathParams === "object") {
                relativeParts = Object.values(req.pathParams)
            } else if (req.pathParams === true) {
                relativeParts = req.splitPath ? req.splitPath.slice(1) : []
            }
        }

        let targetPath = join(targetDir, ...relativeParts)

        if (targetPath.endsWith(PATH_CHARS.SLASH)) {
            targetPath += indexFile
        }

        if (req.splitPath != undefined && req.splitPath?.length > deepestLevel) {
            return
        }

        return resolveFilePath(targetPath).then(async (resolvedPath) => {
            if (!resolvedPath) {
                res.status(HTTP_STATUS.NOT_FOUND)
                return
            }

            try {
                const file = Bun.file(resolvedPath)
                const buffer = await file.arrayBuffer()
                const etag = generateETag(buffer)
                const ifNoneMatch = req.headers.get("if-none-match")

                if (ifNoneMatch && ifNoneMatch === etag) {
                    res.status(304).send()
                    return
                }

                res.setHeader(HTTP_HEADERS.ETAG, etag)
                res.setHeader(HTTP_HEADERS.CACHE_CONTROL, "no-cache")

                const isTypeScript = resolvedPath.endsWith(".ts") || resolvedPath.endsWith(".tsx")
                const isJavaScript = resolvedPath.endsWith(".js") || resolvedPath.endsWith(".jsx") || resolvedPath.endsWith(".mjs")
                const isCSS = resolvedPath.endsWith(".css")

                if (isTypeScript) {
                    let code = await file.text()
                    code = rewriteImports(code, resolvedPath)
                    const transpiled = await transpileCode(code, resolvedPath)
                    res.setHeader(HTTP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.TEXT_JAVASCRIPT)
                    res.send(transpiled)
                } else if (isJavaScript) {
                    let code = await file.text()
                    code = rewriteImports(code, resolvedPath)
                    res.setHeader(HTTP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.TEXT_JAVASCRIPT)
                    res.send(code)
                } else if (isCSS) {
                    const secFetchDest = req.headers.get("sec-fetch-dest")
                    const css = await file.text()

                    if (secFetchDest === "style") {
                        const rewrittenCSS = rewriteCSSImports(css)
                        res.setHeader(HTTP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.TEXT_CSS)
                        res.send(rewrittenCSS)
                    } else {
                        const escapedCSS = JSON.stringify(css)
                        const jsModule = `const css = ${escapedCSS};\nconst style = document.createElement('style');\nstyle.textContent = css;\ndocument.head.appendChild(style);\nexport default css;\n`
                        res.setHeader(HTTP_HEADERS.CONTENT_TYPE, CONTENT_TYPES.TEXT_JAVASCRIPT)
                        res.send(jsModule)
                    }
                } else {
                    res.setHeader(HTTP_HEADERS.CONTENT_TYPE, getContentType(resolvedPath))
                    res.send(buffer)
                }
            } catch (_) {
                res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Error while loading response content")
            }
        }).catch(() => {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Error while resolving file")
        })
    }

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods("GET"),
        handler: devMiddleware
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
            (ctx) => {
                const req = ctx.req
                const res = ctx.res
                res.beforeSent(
                    (res) => storeCookies(req, res)
                )
                parseCookies(req)
            } :
            (ctx) => parseCookies(ctx.req)

    routes.push({
        splitPath: splitRoutePath(path),
        method: parseHttpMethods(method),
        handler: cookiesMiddleware
    })

    return routes
}
