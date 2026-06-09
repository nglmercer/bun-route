export type RewriteMode = "master" | "media"

export type HLSLogLevel = "info" | "warn" | "error"

export interface HLSPluginOptions {
  upstream?: string
  localDir?: string
  proxyBase?: string
  fetchTimeoutMs?: number
  allowedHosts?: string[]
  userAgent?: string
  corsOrigin?: string
  logLevel?: HLSLogLevel | false
  testPage?: boolean
}

export const HLS_DEFAULTS: Required<Omit<HLSPluginOptions, "upstream" | "localDir">> = {
  proxyBase: "/hls/proxy",
  fetchTimeoutMs: 10_000,
  allowedHosts: [],
  userAgent: "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
  corsOrigin: "*",
  logLevel: "info",
  testPage: true,
}
