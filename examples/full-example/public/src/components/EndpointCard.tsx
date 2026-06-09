import { h } from "preact";
import { useState } from "preact/hooks";
import { html } from "htm/preact";
import type { OpenApiOperation, OpenApiParameter } from "../api/spec";
import { TryIt } from "./TryIt";
import { askAI, generateDocs } from "../api/ai";

interface EndpointCardProps {
  path: string;
  method: string;
  safeId: string;
  operation: OpenApiOperation;
  aiDocs?: string;
  aiDocsLoading?: boolean;
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

export function EndpointCard({ path, method, safeId, operation, aiDocs, aiDocsLoading }: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiModal, setAiModal] = useState<{ open: boolean; type: "ask" | "docs" | null; loading: boolean; content: string; error: string | null }>({
    open: false,
    type: null,
    loading: false,
    content: "",
    error: null,
  });
  const [askQuestion, setAskQuestion] = useState("");

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

  const openAiModal = (type: "ask" | "docs") => {
    setAiModal({ open: true, type, loading: false, content: "", error: null });
    setAskQuestion("");
  };

  const closeAiModal = () => {
    setAiModal({ open: false, type: null, loading: false, content: "", error: null });
    setAskQuestion("");
  };

  const handleAskAI = async () => {
    if (!askQuestion.trim()) return;
    setAiModal((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const question = `${askQuestion}\n\nEndpoint: ${method.toUpperCase()} ${path}`;
      const answer = await askAI(question);
      setAiModal((prev) => ({ ...prev, loading: false, content: answer }));
    } catch (err) {
      setAiModal((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to get AI response",
      }));
    }
  };

  const handleGenerateDocs = async () => {
    setAiModal((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const docs = await generateDocs(path, method);
      setAiModal((prev) => ({ ...prev, loading: false, content: docs }));
    } catch (err) {
      setAiModal((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to generate docs",
      }));
    }
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
          <button class="btn btn-ai" onClick=${() => openAiModal("docs")} title="Generate Documentation">
            Docs
          </button>
          <button class="btn btn-ai" onClick=${() => openAiModal("ask")} title="Ask AI about this endpoint">
            Ask AI
          </button>
          <${ExpandArrow} expanded=${expanded} />
        </div>
      </div>
      <div class=${`endpoint-body ${expanded ? "expanded" : ""}`}>
        <div class="endpoint-body-inner">
          ${operation.description ? html`<p class="endpoint-description">${operation.description}</p>` : null}
          ${operation.responses && html`
            <div class="ai-docs-section">
              <div class="ai-docs-header">
                <span class="ai-docs-badge">AI</span>
                <span>Response Schema</span>
              </div>
              <div class="ai-docs-content">
                <pre>${JSON.stringify(operation.responses, null, 2)}</pre>
              </div>
            </div>
          `}
          ${aiDocs
            ? html`
                <div class="ai-docs-section">
                  <div class="ai-docs-header">
                    <span class="ai-docs-badge">AI</span>
                    <span>Documentation</span>
                  </div>
                  <div class="ai-docs-content">
                    <pre>${aiDocs}</pre>
                  </div>
                </div>
              `
            : aiDocsLoading
              ? html`<div class="ai-docs-loading">Generating AI documentation...</div>`
              : null}
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

      ${aiModal.open
        ? html`
            <div class="ai-modal-overlay" onClick=${closeAiModal}>
              <div class="ai-modal" onClick=${(e: Event) => e.stopPropagation()}>
                <div class="ai-modal-header">
                  <h3>${aiModal.type === "ask" ? "Ask AI" : "Endpoint Documentation"}</h3>
                  <button class="ai-modal-close" onClick=${closeAiModal}>×</button>
                </div>
                <div class="ai-modal-body">
                  ${aiModal.type === "ask" && !aiModal.content && !aiModal.loading
                    ? html`
                        <div class="ai-ask-form">
                          <textarea
                            placeholder="Ask a question about this endpoint..."
                            rows=${3}
                            value=${askQuestion}
                            onInput=${(e: Event) => setAskQuestion((e.currentTarget as HTMLTextAreaElement).value)}
                          />
                          <button
                            class="btn btn-ai-send"
                            onClick=${handleAskAI}
                            disabled=${!askQuestion.trim()}
                          >
                            Ask
                          </button>
                        </div>
                      `
                    : null}
                  ${aiModal.loading
                    ? html`<div class="ai-loading">Generating response...</div>`
                    : null}
                  ${aiModal.error
                    ? html`<div class="ai-error">${aiModal.error}</div>`
                    : null}
                  ${aiModal.content
                    ? html`<div class="ai-content"><pre>${aiModal.content}</pre></div>`
                    : null}
                </div>
              </div>
            </div>
          `
        : null}
    </div>
  `;
}
