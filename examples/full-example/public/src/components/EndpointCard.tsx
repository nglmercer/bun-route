import { h } from "preact";
import { useState } from "preact/hooks";
import { html } from "htm/preact";
import type { OpenApiOperation, OpenApiParameter } from "../api/spec";
import { TryIt } from "./TryIt";

interface EndpointCardProps {
  path: string;
  method: string;
  safeId: string;
  operation: OpenApiOperation;
}

function ExpandArrow({ expanded }: { expanded: boolean }) {
  return html`
    <svg
      class=${`endpoint-expand-icon ${expanded ? "expanded" : ""}`}
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  `;
}

function ParametersTable({ params }: { params: OpenApiParameter[] }) {
  return html`
    <div class="endpoint-params">
      <h4>Parameters</h4>
      <table class="params-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>In</th>
            <th>Type</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          ${params.map(
            (p) => html`
              <tr key=${`${p.in}-${p.name}`}>
                <td><code>${p.name}</code></td>
                <td>${p.in}</td>
                <td>${p.schema?.type || "string"}${p.schema?.enum ? html`<span class="param-enum">${p.schema.enum.join(", ")}</span>` : ""}</td>
                <td>${p.required ? html`<span class="required-yes">Yes</span>` : "No"}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}

export function EndpointCard({ path, method, safeId, operation }: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const sampleBody =
      method === "post" || method === "put" || method === "patch"
        ? `-d '${JSON.stringify({ key: "value" }, null, 2)}'`
        : "";
    const curl = `curl -X ${method.toUpperCase()} http://localhost:3000${path} ${sampleBody}`;
    await navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return html`
    <div class=${`endpoint-card ${expanded ? "is-expanded" : ""}`} id=${safeId}>
      <div class="endpoint-header" onClick=${() => setExpanded((v) => !v)}>
        <div class="endpoint-title">
          <span class=${`method-badge method-${method}`}>${method.toUpperCase()}</span>
          <span class="endpoint-path">${path}</span>
          ${operation.summary && html`<span class="endpoint-summary-text">${operation.summary}</span>`}
        </div>
        <div class="endpoint-actions" onClick=${(e: Event) => e.stopPropagation()}>
          <button class="btn btn-copy" onClick=${handleCopy} title="Copy as cURL">
            ${copied ? "Copied!" : "cURL"}
          </button>
          <${ExpandArrow} expanded=${expanded} />
        </div>
      </div>
      <div class=${`endpoint-body ${expanded ? "expanded" : ""}`}>
        <div class="endpoint-body-inner">
          ${operation.parameters && operation.parameters.length > 0
            ? html`<${ParametersTable} params=${operation.parameters} />`
            : null}
          ${expanded
            ? html`
                <div class="tryit-container">
                  <${TryIt} path=${path} method=${method} params=${operation.parameters} />
                </div>
              `
            : null}
        </div>
      </div>
    </div>
  `;
}
