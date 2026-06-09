import { useState } from "preact/hooks";
import type { OpenApiOperation, OpenApiParameter } from "../api/spec";
import { TryIt } from "./TryIt";
import { html } from "../html";

interface EndpointCardProps {
  path: string;
  method: string;
  operation: OpenApiOperation;
}

function methodClass(method: string): string {
  return `method-badge method-${method}`;
}

export function EndpointCard({ path, method, operation }: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const sampleBody =
      method === "post" || method === "put" || method === "patch"
        ? '-d \'{"key": "value"}\''
        : "";
    const curl = `curl -X ${method.toUpperCase()} http://localhost:3000${path} ${sampleBody}`;
    await navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return html`
    <div class="endpoint-card" id="${`${method}-${path}`}">
      <div class="endpoint-header">
        <div class="endpoint-title">
          <span class=${methodClass(method)}>${method.toUpperCase()}</span>
          <span class="endpoint-path">${path}</span>
        </div>
        <div class="endpoint-actions">
          <button class="btn btn-copy" onClick=${handleCopy} title="Copy as cURL">
            ${copied ? "Copied!" : "cURL"}
          </button>
          <button
            class="btn btn-expand"
            onClick=${() => setExpanded((v) => !v)}
            title="Try it out"
          >
            ${expanded ? "Close" : "Try it"}
          </button>
        </div>
      </div>
      <div class="endpoint-body">
        ${operation.summary && html`<p class="endpoint-summary">${operation.summary}</p>`}
        ${operation.parameters && operation.parameters.length > 0
          ? renderParametersTable(operation.parameters)
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
  `;
}

function renderParametersTable(params: OpenApiParameter[]) {
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
              <tr key="${`${p.in}-${p.name}`}">
                <td><code>${p.name}</code></td>
                <td>${p.in}</td>
                <td>
                  ${p.schema?.type || "string"}${p.schema?.enum
                    ? ` (${p.schema.enum.join(", ")})`
                    : ""}
                </td>
                <td>${p.required ? html`<span class="required-yes">Yes</span>` : "No"}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}
