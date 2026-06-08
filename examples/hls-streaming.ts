import {
  Router,
  ResponseBuilder,
  HTTP_HEADERS,
  CONTENT_TYPES,
  CACHE_CONTROL,
  SECURITY_HEADERS,
} from "../src/index";

const router = new Router();

const UPSTREAM_MASTER_URL =
  process.env.HLS_UPSTREAM || "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const PROXY_BASE = "/hls/proxy";
const FETCH_TIMEOUT_MS = 10_000;

const ALLOWED_HOSTS = new Set([
  "test-streams.mux.dev",
  "commondatastorage.googleapis.com",
  "devstreaming-cdn.apple.com",
  "streaming-vod.akamaized.net",
]);

const isAllowedUrl = (urlString: string): boolean => {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
};

const resolveUrl = (relative: string, baseUrl: string): string => {
  const base =
    new URL(baseUrl).origin +
    new URL(baseUrl).pathname.replace(/\/[^/]*$/, "/");
  return new URL(relative, base).toString();
};

type RewriteMode = "master" | "media";

const rewriteManifest = (
  manifest: string,
  baseUrl: string,
  mode: RewriteMode,
): string => {
  const proxyTarget = mode === "master" ? "manifest" : "segment";
  return manifest
    .split("\n")
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
      return `${PROXY_BASE}/${proxyTarget}?url=${encodeURIComponent(absoluteUrl)}`;
    })
    .join("\n");
};

const withTimeout = (signal?: AbortSignal): { controller: AbortController; timeout: ReturnType<typeof setTimeout> } => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }
  return { controller, timeout };
};

const PASSTHROUGH_HEADERS = [
  HTTP_HEADERS.CONTENT_TYPE,
  HTTP_HEADERS.CONTENT_LENGTH,
  HTTP_HEADERS.ACCEPT_RANGES,
  HTTP_HEADERS.CONTENT_RANGE,
];

const setCorsAndSecurity = (res: ResponseBuilder) => {
  res.cors("*").setHeader(HTTP_HEADERS.X_CONTENT_TYPE_OPTIONS, SECURITY_HEADERS.NOSNIFF);
};

const log = (level: "info" | "warn" | "error", msg: string) => {
  const ts = new Date().toISOString();
  console[level](`[${ts}] [HLS] ${msg}`);
};

router.get(`${PROXY_BASE}/manifest`, async ({ req, res }) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !isAllowedUrl(url)) {
    return res.status(400).sendText("Missing or disallowed url parameter");
  }

  log("info", `Manifest proxy: ${url}`);
  const { controller, timeout } = withTimeout(req.signal);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        [HTTP_HEADERS.USER_AGENT]: "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
        [HTTP_HEADERS.ACCEPT]: "*/*",
      },
    });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    const manifest = await response.text();
    const rewritten = rewriteManifest(manifest, url, "media");
    setCorsAndSecurity(res);
    res.contentType(CONTENT_TYPES.APPLICATION_VND_APPLE_MPEGURL).cache(CACHE_CONTROL.NO_CACHE);
    res.send(rewritten);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("error", `Manifest proxy failed for ${url}: ${message}`);
    res.status(502).sendText("Proxy error: upstream request failed");
  } finally {
    clearTimeout(timeout);
  }
});

router.get(`${PROXY_BASE}/segment`, async ({ req, res }) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !isAllowedUrl(url)) {
    return res.status(400).sendText("Missing or disallowed url parameter");
  }

  log("info", `Segment proxy: ${url}`);
  const { controller, timeout } = withTimeout(req.signal);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        [HTTP_HEADERS.USER_AGENT]: "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
        [HTTP_HEADERS.ACCEPT]: "*/*",
        [HTTP_HEADERS.RANGE]: req.headers.get(HTTP_HEADERS.RANGE) || "",
      },
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`Upstream returned ${response.status}`);
    }
    setCorsAndSecurity(res);
    res.cache("public, max-age=600");
    for (const h of PASSTHROUGH_HEADERS) {
      const v = response.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.status(response.status);
    res.send(response.body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("error", `Segment proxy failed for ${url}: ${message}`);
    res.status(502).sendText("Proxy error: upstream request failed");
  } finally {
    clearTimeout(timeout);
  }
});

router.get("/hls/master.m3u8", async ({ req, res }) => {
  setCorsAndSecurity(res);
  res.contentType(CONTENT_TYPES.APPLICATION_VND_APPLE_MPEGURL);

  log("info", `Master manifest: ${UPSTREAM_MASTER_URL}`);
  const { controller, timeout } = withTimeout(req.signal);
  try {
    const response = await fetch(UPSTREAM_MASTER_URL, {
      signal: controller.signal,
      headers: {
        [HTTP_HEADERS.USER_AGENT]: "Mozilla/5.0 (compatible; HLS-Proxy/1.0)",
        [HTTP_HEADERS.ACCEPT]: "*/*",
      },
    });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    const manifest = await response.text();
    const rewritten = rewriteManifest(manifest, UPSTREAM_MASTER_URL, "master");
    res.send(rewritten);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("error", `Master manifest failed: ${message}`);
    res.status(502).sendText("Proxy error: upstream request failed");
  } finally {
    clearTimeout(timeout);
  }
});

const TEST_HTML = `<!DOCTYPE html>
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
</html>`;

router.get("/hls/test.html", ({ res }) => {
  res.contentType(CONTENT_TYPES.TEXT_HTML).send(TEST_HTML);
});

export const server = Bun.serve({
  fetch: router.handle,
  port: 3000,
});

console.info(router.dump(server));
