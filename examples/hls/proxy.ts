import type { ResponseBuilder } from "../../responseBuilder";
import { HTTP_HEADERS, SECURITY_HEADERS } from "../../headers";
import { withTimeout } from "./utils";

const PASSTHROUGH_HEADERS = [
  HTTP_HEADERS.CONTENT_TYPE,
  HTTP_HEADERS.CONTENT_LENGTH,
  HTTP_HEADERS.ACCEPT_RANGES,
  HTTP_HEADERS.CONTENT_RANGE,
];

export function setCorsAndSecurity(res: ResponseBuilder, corsOrigin: string) {
  res
    .cors(corsOrigin)
    .setHeader(HTTP_HEADERS.X_CONTENT_TYPE_OPTIONS, SECURITY_HEADERS.NOSNIFF);
}

export async function proxyManifest(
  url: string,
  res: ResponseBuilder,
  options: {
    userAgent: string;
    corsOrigin: string;
    fetchTimeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<string> {
  const { controller, timeout } = withTimeout(
    options.signal,
    options.fetchTimeoutMs,
  );
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        [HTTP_HEADERS.USER_AGENT]: options.userAgent,
        [HTTP_HEADERS.ACCEPT]: "*/*",
      },
    });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxySegment(
  url: string,
  reqHeaders: Headers,
  res: ResponseBuilder,
  options: {
    userAgent: string;
    corsOrigin: string;
    fetchTimeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<void> {
  const { controller, timeout } = withTimeout(
    options.signal,
    options.fetchTimeoutMs,
  );
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        [HTTP_HEADERS.USER_AGENT]: options.userAgent,
        [HTTP_HEADERS.ACCEPT]: "*/*",
        [HTTP_HEADERS.RANGE]: reqHeaders.get(HTTP_HEADERS.RANGE) || "",
      },
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`Upstream returned ${response.status}`);
    }
    setCorsAndSecurity(res, options.corsOrigin);
    res.cache("public, max-age=600");
    for (const h of PASSTHROUGH_HEADERS) {
      const v = response.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.status(response.status);
    res.send(response.body);
  } finally {
    clearTimeout(timeout);
  }
}
