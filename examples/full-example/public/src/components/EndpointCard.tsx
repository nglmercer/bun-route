import { h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { html } from "htm/preact";
import type { OpenApiOperation, OpenApiParameter } from "../api/spec";
import { TryIt } from "./TryIt";
import { askAI, generateDocs } from "../api/ai";

const aiDocsCache = new Map<string, string>();
const inflightFetches = new Map<string, Promise<string>>();

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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
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
                <td>
                  ${p.schema?.type || "string"}${p.schema?.enum
                    ? html`<span class="param-enum"
                        >${p.schema.enum.join(", ")}</span
                      >`
                    : ""}
                </td>
                <td>
                  ${p.required
                    ? html`<span class="required-yes">Yes</span>`
                    : "No"}
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}

export function EndpointCard({
  path,
  method,
  safeId,
  operation,
}: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inlineDocs, setInlineDocs] = useState<string | null>(null);
  const [inlineDocsLoading, setInlineDocsLoading] = useState(false);
  const fetchedRef = useRef(false);
  const [aiModal, setAiModal] = useState<{
    open: boolean;
    type: "ask" | "docs" | null;
    loading: boolean;
    content: string;
    error: string | null;
  }>({
    open: false,
    type: null,
    loading: false,
    content: "",
    error: null,
  });
  const [askQuestion, setAskQuestion] = useState("");

  const cacheKey = `${method}:${path}`;

  useEffect(() => {
    if (!expanded || fetchedRef.current) return;
    fetchedRef.current = true;
    const cached = aiDocsCache.get(cacheKey);
    if (cached) {
      setInlineDocs(cached);
      return;
    }
    setInlineDocsLoading(true);
    let cancelled = false;
    const fetch = async () => {
      let pending = inflightFetches.get(cacheKey);
      if (!pending) {
        pending = generateDocs(path, method).then((d) => {
          aiDocsCache.set(cacheKey, d);
          return d;
        });
        inflightFetches.set(cacheKey, pending);
      }
      const docs = await pending;
      if (!cancelled) {
        setInlineDocs(docs);
        setInlineDocsLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [expanded, path, method, cacheKey]);

  const handleCopy = async () => {
    const hasReqBody = ["post", "put", "patch"].includes(method);
    const bodyLine = hasReqBody
      ? `\n  body: JSON.stringify({ key: "value" }),`
      : "";
    const fetchCode = `fetch("http://localhost:3000${path}", {
  method: "${method.toUpperCase()}",
  headers: { "Content-Type": "application/json" },${bodyLine}
})
  .then(res => res.json())
  .then(data => console.log(data));`;
    await navigator.clipboard.writeText(fetchCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openAiModal = (type: "ask" | "docs") => {
    setAiModal({ open: true, type, loading: false, content: "", error: null });
    setAskQuestion("");
  };

  const closeAiModal = () => {
    setAiModal({
      open: false,
      type: null,
      loading: false,
      content: "",
      error: null,
    });
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
  return html`
    <div class=${`endpoint-card ${expanded ? "is-expanded" : ""}`} id=${safeId}>
      <div class="endpoint-header" onClick=${() => setExpanded((v) => !v)}>
        <div class="endpoint-title">
          <span class=${`method-badge method-${method}`}
            >${method.toUpperCase()}</span
          >
          <span class="endpoint-path">${path}</span>
          ${operation.summary &&
          html`<span class="endpoint-summary-text">${operation.summary}</span>`}
        </div>
        <div
          class="endpoint-actions"
          onClick=${(e: Event) => e.stopPropagation()}
        >
          <button
            class="btn btn-copy"
            onClick=${handleCopy}
            title="Copy as fetch"
          >
            ${copied ? "Copied!" : "Fetch"}
          </button>
          <button
            class="btn btn-ai"
            onClick=${() => openAiModal("ask")}
            title="Ask AI about this endpoint"
          >
            Ask AI
          </button>
          <${ExpandArrow} expanded=${expanded} />
        </div>
      </div>
      <div class=${`endpoint-body ${expanded ? "expanded" : ""}`}>
        <div class="endpoint-body-inner">
          ${operation.description
            ? html`<p class="endpoint-description">${operation.description}</p>`
            : null}
          ${operation.responses &&
          html`
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
          ${operation.parameters && operation.parameters.length > 0
            ? html`<${ParametersTable} params=${operation.parameters} />`
            : null}
          ${expanded && inlineDocs
            ? html`
                <div class="ai-docs-section">
                  <div class="ai-docs-header">
                    <span class="ai-docs-badge">AI</span>
                    <span>Documentation</span>
                  </div>
                  <div class="ai-docs-content">
                    <pre>${inlineDocs}</pre>
                  </div>
                </div>
              `
            : expanded && inlineDocsLoading
              ? html`<div class="ai-docs-loading">
                  Generating AI documentation...
                </div>`
              : null}
          ${expanded
            ? html`
                <div class="tryit-container">
                  <${TryIt}
                    path=${path}
                    method=${method}
                    params=${operation.parameters}
                  />
                </div>
              `
            : null}
        </div>
      </div>
    </div>
  `;
}
