import type { OpenApiParameter } from "../api/spec";
import { createTryItPanel } from "./try-it";

function methodClass(method: string): string {
  return `method-badge method-${method}`;
}

function renderParameters(params: OpenApiParameter[]): string {
  if (!params || params.length === 0) return "";
  return `
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
          ${params
            .map(
              (p) => `
            <tr>
              <td><code>${p.name}</code></td>
              <td>${p.in}</td>
              <td>${p.schema?.type || "string"}${p.schema?.enum ? ` (${p.schema.enum.join(", ")})` : ""}</td>
              <td>${p.required ? '<span class="required-yes">Yes</span>' : "No"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildUrl(
  path: string,
  params: OpenApiParameter[] | undefined
): string {
  if (!params) return path;
  let url = path;
  const queryParams = params.filter((p) => p.in === "query");
  const pathParams = params.filter((p) => p.in === "path");

  for (const p of pathParams) {
    url = url.replace(`:${p.name}`, `{${p.name}}`);
  }

  if (queryParams.length > 0) {
    url += "?" + queryParams.map((p) => `${p.name}=${p.schema?.default ?? ""}`).join("&");
  }
  return url;
}

export function createEndpointCard(
  path: string,
  method: string,
  operation: import("../api/spec").OpenApiOperation
): HTMLElement {
  const card = document.createElement("div");
  card.className = "endpoint-card";
  card.id = `${method}-${path}`;

  const header = document.createElement("div");
  header.className = "endpoint-header";
  header.innerHTML = `
    <div class="endpoint-title">
      <span class="${methodClass(method)}">${method.toUpperCase()}</span>
      <span class="endpoint-path">${path}</span>
    </div>
    <div class="endpoint-actions">
      <button class="btn btn-copy" title="Copy as cURL">cURL</button>
      <button class="btn btn-expand" title="Try it out">Try it</button>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "endpoint-body";

  if (operation.summary) {
    const summary = document.createElement("p");
    summary.className = "endpoint-summary";
    summary.textContent = operation.summary;
    body.appendChild(summary);
  }

  if (operation.parameters && operation.parameters.length > 0) {
    body.innerHTML += renderParameters(operation.parameters);
  }

  const tryItContainer = document.createElement("div");
  tryItContainer.className = "tryit-container hidden";
  body.appendChild(tryItContainer);

  const expandBtn = header.querySelector(".btn-expand") as HTMLButtonElement;
  const copyBtn = header.querySelector(".btn-copy") as HTMLButtonElement;

  expandBtn.addEventListener("click", () => {
    const isHidden = tryItContainer.classList.contains("hidden");
    tryItContainer.classList.toggle("hidden");
    expandBtn.textContent = isHidden ? "Close" : "Try it";

    if (isHidden && !tryItContainer.hasChildNodes()) {
      createTryItPanel(tryItContainer, path, method, operation.parameters);
    }
  });

  copyBtn.addEventListener("click", () => {
    const sampleBody =
      method === "post" || method === "put" || method === "patch"
        ? '-d \'{"key": "value"}\''
        : "";
    const curl = `curl -X ${method.toUpperCase()} http://localhost:3000${path} ${sampleBody}`;
    navigator.clipboard.writeText(curl);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "cURL"), 1500);
  });

  card.appendChild(header);
  card.appendChild(body);

  return card;
}
