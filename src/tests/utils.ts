import { mock, type Mock } from "bun:test";
import { ResponseBuilder } from "../responseBuilder"; // adjust path
import type { Server } from "bun";
import type { WebSocketData } from "../types";
// Make previously-optional fields required to match the actual Request shape,
// and add the missing `upgraded` property.
type MockRequest = Request & {
    httpMethod: any;
    path: string;
    splitPath: any;
    server: any;
    sock: any;
    cookies: any;
    originCookies: any;
    upgraded?: true;        // ← `boolean` → `true` (literal type to match Bun's Request)
    pathParams?: string[];
};

/**
 * Creates a mock Request object for cookie testing
 */
export const createMockReq = (
    overrides: Partial<MockRequest> = {}
): MockRequest => {
    const { headers, ...rest } = overrides;

    const mockHeaders =
        headers instanceof Headers
            ? headers
            : new Headers((headers as any) || {});

    //@ts-expect-error
    const baseRequest: MockRequest = {
        headers: mockHeaders,
        method: "GET",
        url: "http://localhost/",
        httpMethod: overrides.method ?? "GET",
        path: "/",
        splitPath: ["/"],
        server: undefined,
        sock: undefined,
        cookies: {},
        originCookies: undefined as any,  // ← was [], change to undefined
        ...rest,
    };
    // read-only built-ins we can't spread literally

    return baseRequest;
};

/**
 * Enhanced Response Mock
 */
export interface MockResponse {
    status: Mock<(code: number) => MockResponse>;
    send: Mock<(body: any) => MockResponse>;
    setCookie: Mock<(name: string, value: string, opts?: any) => MockResponse>;
    unsetCookie: Mock<(name: string) => MockResponse>;
    [key: string]: any;
}

export const createMockRes = (): ResponseBuilder => {
    const res = {
        // ── state fields ──────────────────────────────────────────────
        submit: false,
        statusCode: 200,
        statusText: undefined,
        bodyInit: null,
        headers: [] as [string, string][],
        beforeSentHooks: undefined,

        // ── mocked methods (all return `res` for chaining) ────────────
        status: mock(function (this: any) { return res; }),
        send: mock(function (this: any) { res.submit = true; }),
        body: mock(function (this: any) { return res; }),
        setHeader: mock(function (this: any) { return res; }),
        unsetHeader: mock(function (this: any) { return res; }),
        setCookie: mock(function (this: any) { return res; }),
        unsetCookie: mock(function (this: any) { return res; }),
        sendRedirect: mock(function (this: any) { res.submit = true; }),
        sendRedirectCustom: mock(function (this: any) { res.submit = true; }),
        sendBasicAuth: mock(function (this: any) { res.submit = true; }),
        reset: mock(function (this: any) { return res; }),
        build: mock(function (this: any) { return new Response(null); }),
        beforeSent: mock(function (this: any) { return res; }),
        startBeforeSentHook: mock(function (this: any) { }),
    } as unknown as ResponseBuilder;

    return res;
};

/**
 * Mock Server for WebSocket/Upgrade testing.
 * Stubs every member of Bun's Server<WebSocketData> interface so the type
 * check passes without maintaining a separate interface.
 */
export const createMockServer = () => {
    const server = {
        upgrade: mock(() => true),
        pendingWebSockets: 0,
        publish: mock(() => 0),
        requestIP: mock(() => ({ address: "127.0.0.1", family: "IPv4", port: 3000 })),
        stop: mock(async () => { }),
        reload: mock(() => { }),
        fetch: mock(async () => new Response(null)),
        subscriberCount: mock(() => 0),
        subscribe: mock(() => { }),
        unsubscribe: mock(() => { }),
        isSubscribed: mock(() => false),
        cork: mock((cb: any) => cb()),
        ref: mock(() => { }),
        unref: mock(() => { }),
        hostname: "localhost",
        port: 3000,
        development: false,
        id: "",
    } as unknown as Server<WebSocketData>;

    // Read-only in the type but settable via defineProperty on a plain object
    Object.defineProperty(server, "url", {
        value: new URL("http://localhost:3000"),
        writable: false,
        enumerable: true,
        configurable: true,
    });

    return server;
};
