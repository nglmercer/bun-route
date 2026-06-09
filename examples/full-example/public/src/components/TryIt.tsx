import { h } from "preact";
import { useState } from "preact/hooks";
import { html } from "htm/preact";
import type { OpenApiParameter } from "../api/spec";
import { executeRequest } from "./ResponseViewer";
import { ResponseViewerInner } from "./ResponseViewer";
interface TryItProps {
  path: string;
  method: string;
  params?: OpenApiParameter[];
}

function hasBody(method: string): boolean {
  return ["post", "put", "patch"].includes(method);
}

function defaultForParam(p: OpenApiParameter): string {
  if (p.schema?.default !== undefined) return String(p.schema.default);
  if (p.schema?.enum && p.schema.enum.length > 0) return p.schema.enum[0];
  return "";
}

export function TryIt({ path, method, params }: TryItProps) {
  const pathParams = params?.filter((p) => p.in === "path") ?? [];
  const queryParams = params?.filter((p) => p.in === "query") ?? [];
  const initialPathValues: Record<string, string> = {};
  for (const p of pathParams) initialPathValues[p.name] = defaultForParam(p);
  const initialQueryValues: Record<string, string> = {};
  for (const p of queryParams) initialQueryValues[p.name] = defaultForParam(p);

  const [pathValues, setPathValues] =
    useState<Record<string, string>>(initialPathValues);
  const [queryValues, setQueryValues] =
    useState<Record<string, string>>(initialQueryValues);
  const [body, setBody] = useState<string>("{}");
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    headers: string;
    body: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [sending, setSending] = useState(false);

  const updatePath = (name: string, value: string) =>
    setPathValues((prev) => ({ ...prev, [name]: value }));
  const updateQuery = (name: string, value: string) =>
    setQueryValues((prev) => ({ ...prev, [name]: value }));

  const buildUrl = (): string => {
    let url = path;
    for (const p of pathParams) {
      const value = encodeURIComponent(pathValues[p.name] || p.name || "");
      url = url.replace(`:${p.name}`, value);
      url = url.replace(`{${p.name}}`, value);
      if (url.includes("**")) {
        url = url.replace("**", value);
      }
      if (url.includes("*")) {
        url = url.replace("*", value);
      }
    }
    const queryParts: string[] = [];
    for (const p of queryParams) {
      const value = queryValues[p.name];
      if (value) queryParts.push(`${p.name}=${encodeURIComponent(value)}`);
    }
    if (queryParts.length > 0) url += `?${queryParts.join("&")}`;
    return url;
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    setResponse(null);
    setRequestKey((k) => k + 1);
    try {
      const url = buildUrl();
      const requestBody = hasBody(method) ? body : undefined;
      const result = await executeRequest(method, url, requestBody);
      console.log(result);
      return;
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return html`
    <div class="tryit-panel">
      <div class="tryit-request">
        <div class="tryit-url-bar">
          <span class=${`method-badge method-${method}`}
            >${method.toUpperCase()}</span
          >
          <code class="tryit-url">${path}</code>
          <button
            class="btn btn-send"
            onClick=${handleSend}
            disabled=${sending}
          >
            ${sending ? "Sending..." : "Send"}
          </button>
        </div>

        ${pathParams.length > 0
          ? html`
              <div class="tryit-section">
                <h4>Path Parameters</h4>
                ${pathParams.map(
                  (p) => html`
                    <div class="tryit-field" key=${p.name}>
                      <label for=${`param-${p.name}`}>
                        <code>${p.name}</code>${p.required ? " *" : ""}
                      </label>
                      <input
                        type="text"
                        id=${`param-${p.name}`}
                        placeholder=${p.schema?.type || "string"}
                        value=${pathValues[p.name] ?? ""}
                        onInput=${(e: Event) =>
                          updatePath(
                            p.name,
                            (e.currentTarget as HTMLInputElement).value,
                          )}
                      />
                    </div>
                  `,
                )}
              </div>
            `
          : null}
        ${queryParams.length > 0
          ? html`
              <div class="tryit-section">
                <h4>Query Parameters</h4>
                ${queryParams.map(
                  (p) => html`
                    <div class="tryit-field" key=${p.name}>
                      <label for=${`param-${p.name}`}>
                        <code>${p.name}</code>${p.required ? " *" : ""}
                      </label>
                      ${p.schema?.enum
                        ? html`
                            <select
                              id=${`param-${p.name}`}
                              value=${queryValues[p.name] ?? ""}
                              onChange=${(e: Event) =>
                                updateQuery(
                                  p.name,
                                  (e.currentTarget as HTMLSelectElement).value,
                                )}
                            >
                              <option value="">-- select --</option>
                              ${p.schema.enum.map(
                                (v) =>
                                  html`<option value=${v} key=${v}>
                                    ${v}
                                  </option>`,
                              )}
                            </select>
                          `
                        : html`
                            <input
                              type="text"
                              id=${`param-${p.name}`}
                              placeholder=${p.schema?.type || "string"}
                              value=${queryValues[p.name] ?? ""}
                              onInput=${(e: Event) =>
                                updateQuery(
                                  p.name,
                                  (e.currentTarget as HTMLInputElement).value,
                                )}
                            />
                          `}
                    </div>
                  `,
                )}
              </div>
            `
          : null}
        ${hasBody(method)
          ? html`
              <div class="tryit-section">
                <h4>Request Body</h4>
                <div class="tryit-body-editor">
                  <textarea
                    id="tryit-body"
                    placeholder='{"key": "value"}'
                    rows=${6}
                    value=${body}
                    onInput=${(e: Event) =>
                      setBody((e.currentTarget as HTMLTextAreaElement).value)}
                  />
                </div>
              </div>
            `
          : null}
      </div>

      <div class="tryit-response" id="tryit-response">
        ${error
          ? html`
              <div class="response-header status-server-err">
                <span class="response-status">Error</span>
              </div>
              <div class="response-body">
                <pre class="error-text">${error}</pre>
              </div>
            `
          : response
            ? html`
                <${ResponseViewerInner}
                  status=${response.status}
                  statusText=${response.statusText}
                  headers=${response.headers}
                  body=${response.body}
                  requestKey=${requestKey}
                />
              `
            : null}
      </div>
    </div>
  `;
}
