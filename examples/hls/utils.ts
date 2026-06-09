import type { HLSLogLevel } from "./types"

export function isAllowedUrl(urlString: string, allowedHosts: Set<string>): boolean {
  try {
    const parsed = new URL(urlString)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
    if (allowedHosts.size === 0) return false
    return allowedHosts.has(parsed.hostname)
  } catch {
    return false
  }
}

export function resolveUrl(relative: string, baseUrl: string): string {
  const base =
    new URL(baseUrl).origin +
    new URL(baseUrl).pathname.replace(/\/[^/]*$/, "/")
  return new URL(relative, base).toString()
}

export function isManifestUrl(url: string): boolean {
  try {
    const pathname = new URL(url, "https://placeholder.com").pathname
    return pathname.endsWith(".m3u8") || !pathname.includes(".")
  } catch {
    return false
  }
}

export function withTimeout(
  signal?: AbortSignal,
  timeoutMs: number = 10_000,
): { controller: AbortController; timeout: ReturnType<typeof setTimeout> } {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) {
    signal.addEventListener("abort", () => controller.abort())
  }
  return { controller, timeout }
}

export function createLogger(prefix: string, level: HLSLogLevel | false) {
  if (level === false) {
    return () => {}
  }
  const levels: HLSLogLevel[] = ["info", "warn", "error"]
  const minIndex = levels.indexOf(level)

  return (logLevel: HLSLogLevel, msg: string) => {
    if (levels.indexOf(logLevel) < minIndex) return
    const ts = new Date().toISOString()
    console[logLevel](`[${ts}] [${prefix}] ${msg}`)
  }
}
