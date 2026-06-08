import { Router } from "../src/index";

const router = new Router();

const UPSTREAM_MASTER_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const PROXY_BASE = "/hls/proxy";

const resolveUrl = (relative: string, baseUrl: string): string => {
  const base =
    new URL(baseUrl).origin +
    new URL(baseUrl).pathname.replace(/\/[^/]*$/, "/");
  return new URL(relative, base).toString();
};

const rewriteMediaPlaylist = (manifest: string, baseUrl: string): string => {
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
        absoluteUrl = resolveUrl(trimmed, baseUrl);
      }
      return `${PROXY_BASE}/segment?url=${encodeURIComponent(absoluteUrl)}`;
    })
    .join("\n");
};

router.get(`${PROXY_BASE}/manifest`, async ({ req, res }) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return res.status(400).sendText("Missing url parameter");
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
        Accept: "*/*",
      },
    });
    if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
    const manifest = await response.text();
    const rewritten = rewriteMediaPlaylist(manifest, url);
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

router.get("/hls/master.m3u8", async ({ req, res }) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  try {
    const response = await fetch(UPSTREAM_MASTER_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
        Accept: "*/*",
      },
    });
    if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
    const manifest = await response.text();
    const lines = manifest.split("\n");
    const base =
      new URL(UPSTREAM_MASTER_URL).origin +
      new URL(UPSTREAM_MASTER_URL).pathname.replace(/\/[^/]*$/, "/");
    const rewritten = lines
      .map((line) => {
        if (line.startsWith("#")) return line;
        const trimmed = line.trim();
        if (!trimmed) return line;
        let absoluteUrl: string;
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          absoluteUrl = trimmed;
        } else {
          absoluteUrl = resolveUrl(trimmed, UPSTREAM_MASTER_URL);
        }
        return `${PROXY_BASE}/manifest?url=${encodeURIComponent(absoluteUrl)}`;
      })
      .join("\n");
    res.send(rewritten);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(502).sendText(`Proxy error: ${message}`);
  }
});

router.get("/hls/test.html", ({ req, res }) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>HLS Test Player</title>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js"></script>
    <style>
        body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; margin: 20px; }
        video { background: #000; }
        #log { background: #0d1117; padding: 10px; margin-top: 10px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; font-size: 12px; border: 1px solid #30363d; }
        .error { color: #f85149; }
        .info { color: #58a6ff; }
        .success { color: #3fb950; }
    </style>
</head>
<body>
    <h2>HLS Proxy Player</h2>
    <video id="video" controls width="640" height="360"></video>
    <div id="log"></div>
    <script>
        const logEl = document.getElementById('log');
        function log(msg, cls = 'info') {
            const line = document.createElement('div');
            line.className = cls;
            line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
            logEl.appendChild(line);
            logEl.scrollTop = logEl.scrollHeight;
        }

        const video = document.getElementById('video');
        const videoSrc = '/hls/master.m3u8';

        log('Player starting, source: ' + videoSrc);

        if (Hls.isSupported()) {
            log('HLS.js supported, creating instance');
            const hls = new Hls({
                debug: true,
                enableWorker: true,
                lowLatencyMode: false,
            });
            hls.loadSource(videoSrc);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
                log('MANIFEST_PARSED: ' + data.levels.length + ' quality levels', 'success');
                hls.currentLevel = 0;
                video.play().catch(err => log('Play blocked: ' + err.message, 'error'));
            });
            hls.on(Hls.Events.LEVEL_SWITCHING, (e, data) => {
                log('LEVEL_SWITCHING: level ' + data.level);
            });
            hls.on(Hls.Events.ERROR, (e, data) => {
                log('ERROR: ' + data.type + ' - ' + data.details + (data.response ? ' (' + data.response.code + ')' : ''), 'error');
                if (data.fatal) {
                    log('FATAL ERROR, attempting recovery...', 'error');
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad();
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        log('Unrecoverable error', 'error');
                    }
                }
            });
            hls.on(Hls.Events.FRAG_LOADED, (e, data) => {
                log('FRAG_LOADED: ' + data.frag.url.split('/').pop());
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            log('Native HLS support (Safari), using native playback');
            video.src = videoSrc;
            video.addEventListener('loadedmetadata', () => {
                log('Native metadata loaded', 'success');
                video.play().catch(err => log('Play blocked: ' + err.message, 'error'));
            });
            video.addEventListener('error', () => {
                log('Video error: ' + video.error?.message, 'error');
            });
        } else {
            log('HLS not supported in this browser', 'error');
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
