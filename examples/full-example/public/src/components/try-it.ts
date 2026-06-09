import type { OpenApiParameter } from "../api/spec";
import { createResponseDisplay } from "./response";

function buildUrl(
  path: string,
  params: OpenApiParameter[] | undefined
): string {
  if (!params) return path;
  let url = path;
  const pathParams = params.filter((p) => p.in === "path");
  for (const p of pathParams) {
    const input = document.getElementById(`param-${p.name}`) as HTMLInputElement;
    const value = input?.value || `{${p.name}}`;
    url = url.replace(`:${p.name}`, encodeURIComponent(value));
  }
  return url;
}

function getQueryString(params: OpenApiParameter[] | undefined): string {
  if (!params) return "";
  const queryParams = params.filter((p) => p.in === "query");
  const parts: string[] = [];
  for (const p of queryParams) {
    const input = document.getElementById(`param-${p.name}`) as HTMLInputElement;
    const value = input?.value;
    if (value) parts.push(`${p.name}=${encodeURIComponent(value)}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

function hasBody(method: string): boolean {
  return ["post", "put", "patch"].includes(method);
}

function renderPathParams(params: OpenApiParameter[] | undefined): string {
  if (!params) return "";
  const pathParams = params.filter((p) => p.in === "path");
  if (pathParams.length === 0) return "";

  return `
    <div class="tryit-section">
      <h4>Path Parameters</h4>
      ${pathParams
        .map(
          (p) => `
        <div class="tryit-field">
          <label for="param-${p.name}">
            <code>${p.name}</code>${p.required ? " *" : ""}
          </label>
          <input type="text" id="param-${p.name}" placeholder="${p.schema?.type || "string"}" value="${p.schema?.default ?? ""}" />
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function renderQueryParams(params: OpenApiParameter[] | undefined): string {
  if (!params) return "";
  const queryParams = params.filter((p) => p.in === "query");
  if (queryParams.length === 0) return "";

  return `
    <div class="tryit-section">
      <h4>Query Parameters</h4>
      ${queryParams
        .map(
          (p) => `
        <div class="tryit-field">
          <label for="param-${p.name}">
            <code>${p.name}</code>${p.required ? " *" : ""}
          </label>
          ${
            p.schema?.enum
              ? `<select id="param-${p.name}">
                  <option value="">-- select --</option>
                  ${p.schema.enum.map((v) => `<option value="${v}" ${v === p.schema?.default ? "selected" : ""}>${v}</option>`).join("")}
                </select>`
              : `<input type="text" id="param-${p.name}" placeholder="${p.schema?.type || "string"}" value="${p.schema?.default ?? ""}" />`
          }
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function renderBodyEditor(method: string): string {
  if (!hasBody(method)) return "";
  return `
    <div class="tryit-section">
      <h4>Request Body</h4>
      <div class="tryit-body-editor">
        <textarea id="tryit-body" placeholder='{"key": "value"}' rows="6">{}</textarea>
      </div>
    </div>
  `;
}

export function createTryItPanel(
  container: HTMLElement,
  path: string,
  method: string,
  params: OpenApiParameter[] | undefined
): void {
  container.innerHTML = `
    <div class="tryit-panel">
      <div class="tryit-request">
        <div class="tryit-url-bar">
          <span class="method-badge method-${method}">${method.toUpperCase()}</span>
          <code class="tryit-url">${path}</code>
          <button class="btn btn-send" id="tryit-send">Send</button>
        </div>
        ${renderPathParams(params)}
        ${renderQueryParams(params)}
        ${renderBodyEditor(method)}
      </div>
      <div class="tryit-response" id="tryit-response"></div>
    </div>
  `;

  const sendBtn = container.querySelector("#tryit-send") as HTMLButtonElement;
  sendBtn.addEventListener("click", async () => {
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    const url = buildUrl(path, params) + getQueryString(params);
    const body = hasBody(method)
      ? (container.querySelector("#tryit-body") as HTMLTextAreaElement)?.value
      : undefined;

    const responseContainer = container.querySelector(
      "#tryit-response"
    ) as HTMLElement;
    createResponseDisplay(responseContainer, method, url, body);

    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  });
}
