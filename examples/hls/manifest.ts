import type { RewriteMode } from "./types"
import { resolveUrl } from "./utils"

export function rewriteManifest(
  manifest: string,
  baseUrl: string,
  proxyBase: string,
  mode: RewriteMode,
): string {
  const proxyTarget = mode === "master" ? "manifest" : "segment"
  return manifest
    .split("\n")
    .map((line) => {
      if (line.startsWith("#")) return line
      const trimmed = line.trim()
      if (!trimmed) return line
      let absoluteUrl: string
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        absoluteUrl = trimmed
      } else {
        absoluteUrl = resolveUrl(trimmed, baseUrl)
      }
      return `${proxyBase}/${proxyTarget}?url=${encodeURIComponent(absoluteUrl)}`
    })
    .join("\n")
}

export function rewriteManifestLocal(
  manifest: string,
  baseUrl: string,
  proxyBase: string,
  mode: RewriteMode,
): string {
  const proxyTarget = mode === "master" ? "manifest" : "segment"
  return manifest
    .split("\n")
    .map((line) => {
      if (line.startsWith("#")) return line
      const trimmed = line.trim()
      if (!trimmed) return line
      let absoluteUrl: string
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        absoluteUrl = trimmed
      } else {
        absoluteUrl = resolveUrl(trimmed, baseUrl)
      }
      const urlObj = new URL(absoluteUrl)
      const pathname = decodeURIComponent(urlObj.pathname)
      const filename = pathname.split("/").pop() || pathname
      return `${proxyBase}/${proxyTarget}?file=${encodeURIComponent(filename)}`
    })
    .join("\n")
}
