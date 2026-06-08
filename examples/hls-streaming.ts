import { Router } from "../src/index";

const router = new Router();

const UPSTREAM_MASTER_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const PROXY_BASE = "/hls/proxy";

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
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return `${PROXY_BASE}/segment?url=${encodeURIComponent(trimmed)}`;
      }
      return `${PROXY_BASE}/segment?url=${encodeURIComponent(new URL(trimmed, base).toString())}`;
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
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = videoSrc;
            video.addEventListener('loadedmetadata', () => {
            });
        }
    </script>
</body>
</html>
`);
});

export const server = Bun.serve({
  fetch: router.handle,
  port: 3000,
});

console.info(router.dump(server));
