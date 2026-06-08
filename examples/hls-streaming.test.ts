import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { Router } from "../src/index";

const PROXY_BASE = "/hls/proxy";
const UPSTREAM_MASTER_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

function setupRouter() {
  const router = new Router();

  const isManifestUrl = (url: string): boolean => {
    const pathname = new URL(url, "https://placeholder.com").pathname;
    return pathname.endsWith(".m3u8") || !pathname.includes(".");
  };

  const rewriteManifest = (manifest: string, baseUrl: string): string => {
    const lines = manifest.split("\n");
    const base =
      new URL(baseUrl).origin +
      new URL(baseUrl).pathname.replace(/\/[^/]*$/, "/");
    return lines
      .map((line) => {
        if (line.startsWith("#")) return line;
        const trimmed = line.trim();
        if (!trimmed) return line;
        let absoluteUrl: string;
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          absoluteUrl = trimmed;
        } else {
          absoluteUrl = new URL(trimmed, base).toString();
        }
        const endpoint = isManifestUrl(absoluteUrl) ? "manifest" : "segment";
        return `${PROXY_BASE}/${endpoint}?url=${encodeURIComponent(absoluteUrl)}`;
      })
      .join("\n");
  };

  router.get(`${PROXY_BASE}/manifest`, async ({ req, res }) => {
    const url = new URL(req.url).searchParams.get("url") || UPSTREAM_MASTER_URL;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
          Accept: "*/*",
        },
      });
      if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
      const manifest = await response.text();
      const rewritten = rewriteManifest(manifest, url);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache");
      res.send(rewritten);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(502).sendText(`Proxy error: ${message}`);
    }
  });

  router.get(`${PROXY_BASE}/segment`, async ({ req, res }) => {
    const url = new URL(req.url).searchParams.get("url");
    if (!url) return res.status(400).sendText("Missing url parameter");
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
          Accept: "*/*",
          Range: req.headers.get("Range") || "",
        },
      });
      if (!response.ok && response.status !== 206)
        throw new Error(`Upstream error: ${response.status}`);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      if (response.headers.get("Content-Type")) {
        res.setHeader("Content-Type", response.headers.get("Content-Type")!);
      }
      if (response.headers.get("Content-Length")) {
        res.setHeader("Content-Length", response.headers.get("Content-Length")!);
      }
      if (response.headers.get("Accept-Ranges")) {
        res.setHeader("Accept-Ranges", response.headers.get("Accept-Ranges")!);
      }
      if (response.headers.get("Content-Range")) {
        res.setHeader("Content-Range", response.headers.get("Content-Range")!);
      }
      res.status(response.status);
      res.send(response.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(502).sendText(`Proxy error: ${message}`);
    }
  });

  router.get("/hls/master.m3u8", ({ req, res }) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
${PROXY_BASE}/manifest?url=${encodeURIComponent(UPSTREAM_MASTER_URL)}
`;
    res.send(manifest);
  });

  router.get("/hls/test.html", ({ req, res }) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>HLS Test Player</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js"></script>
</head>
<body>
    <video id="video" controls width="640" height="360"></video>
    <script>
        const video = document.getElementById('video');
        const videoSrc = '/hls/master.m3u8';
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(videoSrc);
            hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = videoSrc;
        }
    </script>
</body>
</html>
`);
  });

  return router;
}

describe("HLS Streaming Proxy", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeAll(() => {
    const router = setupRouter();
    server = Bun.serve({ port: 0, fetch: router.handle });
    baseUrl = server.url.href;
  });

  afterAll(() => {
    server.stop();
  });

  it("GET /hls/master.m3u8 returns valid master manifest with correct headers", async () => {
    const resp = await fetch(`${baseUrl}/hls/master.m3u8`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Type")).toBe("application/vnd.apple.mpegurl");
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const body = await resp.text();
    expect(body).toContain("#EXTM3U");
    expect(body).toContain("#EXT-X-VERSION:3");
    expect(body).toContain("#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720");
    expect(body).toContain(`${PROXY_BASE}/manifest?url=`);
    expect(body).toContain(encodeURIComponent(UPSTREAM_MASTER_URL));
  });

  it("GET /hls/test.html returns HTML player page with hls.js", async () => {
    const resp = await fetch(`${baseUrl}/hls/test.html`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Type")).toBe("text/html");

    const body = await resp.text();
    expect(body).toContain("<!DOCTYPE html>");
    expect(body).toContain("hls.js");
    expect(body).toContain("/hls/master.m3u8");
    expect(body).toContain("<video");
    expect(body).toContain("Hls.isSupported()");
  });

  it("GET /hls/proxy/segment without url parameter returns error body", async () => {
    const resp = await fetch(`${baseUrl}${PROXY_BASE}/segment`);
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toBe("Missing url parameter");
  });

  it("GET /hls/proxy/manifest with invalid URL returns error body", async () => {
    const resp = await fetch(
      `${baseUrl}${PROXY_BASE}/manifest?url=${encodeURIComponent("http://invalid.invalid/test.m3u8")}`
    );
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toContain("Proxy error:");
  });

  it("GET /hls/proxy/segment with invalid URL returns error body", async () => {
    const resp = await fetch(
      `${baseUrl}${PROXY_BASE}/segment?url=${encodeURIComponent("http://invalid.invalid/test.ts")}`
    );
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toContain("Proxy error:");
  });

  it("isManifestUrl detects .m3u8 files as manifests", () => {
    const isManifestUrl = (url: string): boolean => {
      const pathname = new URL(url, "https://placeholder.com").pathname;
      return pathname.endsWith(".m3u8") || !pathname.includes(".");
    };

    expect(isManifestUrl("https://example.com/master.m3u8")).toBe(true);
    expect(isManifestUrl("https://example.com/path/playlist.m3u8")).toBe(true);
    expect(isManifestUrl("https://example.com/segment.ts")).toBe(false);
    expect(isManifestUrl("https://example.com/video.mp4")).toBe(false);
    expect(isManifestUrl("https://example.com/chunk.vtt")).toBe(false);
    expect(isManifestUrl("url_0/193039199_mp4_h264_aac_hd_7.m3u8")).toBe(true);
    expect(isManifestUrl("url_0/193039199_mp4_h264_aac_hd_7.ts")).toBe(false);
  });

  it("rewriteManifest routes .m3u8 URLs through /manifest and .ts through /segment", () => {
    const rewriteManifest = (manifest: string, baseUrl: string): string => {
      const isManifestUrl = (url: string): boolean => {
        const pathname = new URL(url, "https://placeholder.com").pathname;
        return pathname.endsWith(".m3u8") || !pathname.includes(".");
      };
      const lines = manifest.split("\n");
      const base =
        new URL(baseUrl).origin +
        new URL(baseUrl).pathname.replace(/\/[^/]*$/, "/");
      return lines
        .map((line) => {
          if (line.startsWith("#")) return line;
          const trimmed = line.trim();
          if (!trimmed) return line;
          let absoluteUrl: string;
          if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            absoluteUrl = trimmed;
          } else {
            absoluteUrl = new URL(trimmed, base).toString();
          }
          const endpoint = isManifestUrl(absoluteUrl) ? "manifest" : "segment";
          return `${PROXY_BASE}/${endpoint}?url=${encodeURIComponent(absoluteUrl)}`;
        })
        .join("\n");
    };

    const masterManifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2149280,RESOLUTION=1280x720
url_0/193039199_mp4_h264_aac_hd_7.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=246440,RESOLUTION=320x184
url_2/193039199_mp4_h264_aac_ld_7.m3u8`;

    const rewritten = rewriteManifest(masterManifest, "https://example.com/path/master.m3u8");

    expect(rewritten).toContain(`${PROXY_BASE}/manifest?url=`);
    expect(rewritten).not.toContain(`${PROXY_BASE}/segment?url=`);
    expect(rewritten).toContain(encodeURIComponent("https://example.com/path/url_0/193039199_mp4_h264_aac_hd_7.m3u8"));

    const mediaManifest = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment0.ts
#EXTINF:10.0,
segment1.ts`;

    const rewrittenMedia = rewriteManifest(mediaManifest, "https://example.com/path/playlist.m3u8");

    expect(rewrittenMedia).toContain(`${PROXY_BASE}/segment?url=`);
    expect(rewrittenMedia).not.toContain(`${PROXY_BASE}/manifest?url=`);
    expect(rewrittenMedia).toContain(encodeURIComponent("https://example.com/path/segment0.ts"));
    expect(rewrittenMedia).toContain(encodeURIComponent("https://example.com/path/segment1.ts"));
  });

  it("rewriteManifest handles absolute URLs in manifest", () => {
    const isManifestUrl = (url: string): boolean => {
      const pathname = new URL(url, "https://placeholder.com").pathname;
      return pathname.endsWith(".m3u8") || !pathname.includes(".");
    };

    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2149280
https://cdn.example.com/playlist.m3u8
#EXTINF:10.0,
https://cdn.example.com/segments/seg0.ts`;

    const lines = manifest.split("\n");
    const base = "https://example.com/";
    const rewritten = lines
      .map((line) => {
        if (line.startsWith("#")) return line;
        const trimmed = line.trim();
        if (!trimmed) return line;
        let absoluteUrl: string;
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          absoluteUrl = trimmed;
        } else {
          absoluteUrl = new URL(trimmed, base).toString();
        }
        const endpoint = isManifestUrl(absoluteUrl) ? "manifest" : "segment";
        return `${PROXY_BASE}/${endpoint}?url=${encodeURIComponent(absoluteUrl)}`;
      })
      .join("\n");

    expect(rewritten).toContain(`${PROXY_BASE}/manifest?url=${encodeURIComponent("https://cdn.example.com/playlist.m3u8")}`);
    expect(rewritten).toContain(`${PROXY_BASE}/segment?url=${encodeURIComponent("https://cdn.example.com/segments/seg0.ts")}`);
  });

  it("rewriteManifest preserves comments and empty lines", () => {
    const isManifestUrl = (url: string): boolean => {
      const pathname = new URL(url, "https://placeholder.com").pathname;
      return pathname.endsWith(".m3u8") || !pathname.includes(".");
    };

    const manifest = `#EXTM3U
#EXT-X-VERSION:3

#EXT-X-TARGETDURATION:10`;

    const lines = manifest.split("\n");
    const base = "https://example.com/";
    const rewritten = lines
      .map((line) => {
        if (line.startsWith("#")) return line;
        const trimmed = line.trim();
        if (!trimmed) return line;
        let absoluteUrl: string;
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          absoluteUrl = trimmed;
        } else {
          absoluteUrl = new URL(trimmed, base).toString();
        }
        const endpoint = isManifestUrl(absoluteUrl) ? "manifest" : "segment";
        return `${PROXY_BASE}/${endpoint}?url=${encodeURIComponent(absoluteUrl)}`;
      })
      .join("\n");

    expect(rewritten).toContain("#EXTM3U");
    expect(rewritten).toContain("#EXT-X-VERSION:3");
    expect(rewritten).toContain("#EXT-X-TARGETDURATION:10");
    expect(rewritten.split("\n").length).toBe(4);
  });

  it("GET /hls/proxy/manifest fetches and rewrites upstream manifest", async () => {
    const resp = await fetch(
      `${baseUrl}${PROXY_BASE}/manifest?url=${encodeURIComponent(UPSTREAM_MASTER_URL)}`
    );
    expect(resp.status).toBe(200);
    expect(resp.headers.get("Content-Type")).toBe("application/vnd.apple.mpegurl");
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(resp.headers.get("Cache-Control")).toBe("no-cache");

    const body = await resp.text();
    expect(body).toContain("#EXTM3U");
    expect(body).toContain(`${PROXY_BASE}/manifest?url=`);
    expect(body).not.toContain(`${PROXY_BASE}/segment?url=`);
  });
});
