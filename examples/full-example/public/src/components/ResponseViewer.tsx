import { h } from "preact";
import { useRef, useEffect, useState } from "preact/hooks";
import { html } from "htm/preact";
import { apiFetchRaw } from "../api/client";

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

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "status-ok";
  if (status >= 300 && status < 400) return "status-redirect";
  if (status >= 400 && status < 500) return "status-client-err";
  return "status-server-err";
}

function formatBody(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function SafePre({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = text;
    }
  }, [text]);
  return h("pre", { ref, class: className });
}

export function ResponseViewer({
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

  const formattedBody = formatBody(body);

  return html`
    <div>
      <div class=${`response-header ${cls}`}>
        <span class="response-status">${status} ${statusText}</span>
        <button class="btn btn-copy-res" onClick=${handleCopy}>
          ${copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div class="response-headers">
        <details>
          <summary>Response Headers</summary>
          <${SafePre} text=${headers} />
        </details>
      </div>
      <div class="response-body">
        <${SafePre} text=${formattedBody} />
      </div>
    </div>
  `;
}
