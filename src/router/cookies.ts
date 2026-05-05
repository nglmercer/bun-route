import type { Request } from "../types"
import { ResponseBuilder } from "../responseBuilder"
import { trimSpaces } from "../path"

/**
 * Parses the cookie header of the request and sets the cookies property of the request.
 * @param req The request to parse the cookies for
 * @param forceReload Whether to force reload cookies from origin
 */
export function parseCookies(
    req: Request,
    forceReload: boolean = false,
): void {
    if (!req.originCookies) {
        req.cookies = {}
        const cookieHeader = req.headers.get("cookie")
        if (!cookieHeader) {
            req.originCookies = {}
            return
        }

        const pairs = cookieHeader.split(/; */)
        for (const pair of pairs) {
            const splitted = pair.split('=')
            const name = trimSpaces(splitted[0])
            if (name.length != 0) {
                req.cookies[name] = decodeURIComponent(
                    trimSpaces(splitted
                        .slice(1)
                        .join('='))
                )
            }
        }

        req.originCookies = {
            ...req.cookies
        }
    } else if (forceReload) {
        req.cookies = {
            ...req.originCookies
        }
    }
}

/**
 * Stores the cookies in the request object into the response.
 * 
 * If the value of a cookie is changed, it will be set in the response.
 * If a cookie is deleted, it will be unset in the response.
 * @param req The request that contains the cookies.
 * @param res The response that will be modified.
 */
export function storeCookies(
    req: Request,
    res: ResponseBuilder,
): void {
    if (!req.cookies) {
        res.reset()
            .status(500)
            .send("Request cookies store error")
        return
    }

    const newCookies = req.cookies
    const oldCookies: {
        [key: string]: string
    } = req.originCookies as any ?? {}

    const newCookieKeys = Object.keys(newCookies)
    for (const cookieKey of newCookieKeys) {
        if (
            newCookies[cookieKey] && (
                !oldCookies[cookieKey] ||
                oldCookies[cookieKey] !== newCookies[cookieKey]
            )
        ) {
            res.setCookie(cookieKey, newCookies[cookieKey])
        }
    }

    for (const cookieKey of Object.keys(oldCookies)) {
        if (!newCookieKeys.includes(cookieKey)) {
            res.unsetCookie(cookieKey)
        }
    }

    req.cookies = newCookies
}
