import { apiFetchRaw } from "../api/client";

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "status-ok";
  if (status >= 300 && status < 400) return "status-redirect";
  if (status >= 400 && status < 500) return "status-client-err";
  return "status-server-err";
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createResponseDisplay(
  container: HTMLElement,
  method: string,
  url: string,
  body?: string
): void {
  container.innerHTML = `<div class="response-loading">Sending request...</div>`;

  (async () => {
    try {
      const opts: { method: string; body?: string; headers?: Record<string, string> } = {
        method: method.toUpperCase(),
      };
      if (body) {
        opts.body = body;
        opts.headers = { "Content-Type": "application/json" };
      }

      const result = await apiFetchRaw(url, opts);
      const cls = statusClass(result.status);

      const headersStr = [...result.headers.entries()]
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      container.innerHTML = `
        <div class="response-header ${cls}">
          <span class="response-status">${result.status} ${result.statusText}</span>
          <button class="btn btn-copy-res" title="Copy response">Copy</button>
        </div>
        <div class="response-headers">
          <details>
            <summary>Response Headers</summary>
            <pre>${escapeHtml(headersStr)}</pre>
          </details>
        </div>
        <div class="response-body">
          <pre><code>${escapeHtml(formatJson(result.body))}</code></pre>
        </div>
      `;

      const copyBtn = container.querySelector(".btn-copy-res") as HTMLButtonElement;
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(result.body);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
      });
    } catch (err) {
      container.innerHTML = `
        <div class="response-header status-server-err">
          <span class="response-status">Error</span>
        </div>
        <div class="response-body">
          <pre class="error-text">${escapeHtml(
            err instanceof Error ? err.message : String(err)
          )}</pre>
        </div>
      `;
    }
  })();
}
