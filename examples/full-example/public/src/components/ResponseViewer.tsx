import { useState } from "preact/hooks";
import { apiFetchRaw } from "../api/client";
import { html } from "../html";

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

export async function executeRequest(
  method: string,
  url: string,
  body?: string,
): Promise<{
  status: number;
  statusText: string;
  headers: string;
  body: string;
}> {
  const opts: { method: string; body?: string; headers?: Record<string, string> } = {
    method: method.toUpperCase(),
  };
  if (body) {
    opts.body = body;
    opts.headers = { "Content-Type": "application/json" };
  }

  const result = await apiFetchRaw(url, opts);
  const headersStr = [...result.headers.entries()]
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return {
    status: result.status,
    statusText: result.statusText,
    headers: headersStr,
    body: result.body,
  };
}

export function ResponseViewerInner({
  status,
  statusText,
  headers,
  body,
}: {
  status: number;
  statusText: string;
  headers: string;
  body: string;
  requestKey: number;
}) {
  const [copied, setCopied] = useState(false);
  const cls = statusClass(status);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return html`
    <>
      <div class=${`response-header ${cls}`}>
        <span class="response-status">${status} ${statusText}</span>
        <button class="btn btn-copy-res" onClick=${handleCopy}>
          ${copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div class="response-headers">
        <details>
          <summary>Response Headers</summary>
          <pre>${headers}</pre>
        </details>
      </div>
      <div class="response-body">
        <pre><code>${formatJson(body)}</code></pre>
      </div>
    </>
  `;
}
