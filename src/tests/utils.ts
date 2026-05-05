// test-utils.ts
import { mock } from "bun:test";

/**
 * Creates a mock Request object for cookie testing
 */
export const createMockReq = (overrides: Record<string, any> = {}) => {
    const headers = overrides.headers instanceof Headers
        ? overrides.headers
        : new Headers(overrides.headers || {});

    return {
        headers,
        cookies: overrides.cookies,
        originCookies: overrides.originCookies,
        ...overrides
    } as any; // Cast here so you don't have to in tests
};

/**
 * Creates a mock Response object with spies
 */
export const createMockRes = () => {
    const res: any = {};

    // Use the mock() function imported from bun:test
    res.reset = mock(() => res);
    res.status = mock(() => res);
    res.send = mock(() => res);
    res.setCookie = mock(() => res);
    res.unsetCookie = mock(() => res);

    return res;
};