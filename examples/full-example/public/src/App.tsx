import { fetchSpec, groupEndpoints } from "./api/spec";
import type { OpenApiSpec } from "./api/spec";
import { Sidebar } from "./components/Sidebar";
import { EndpointCard } from "./components/EndpointCard";
import { h } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { html } from "htm/preact";

type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("theme");
  return stored === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return html`
    <button
      class="theme-toggle"
      onClick=${() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
    >
      ${theme === "dark"
        ? html`
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            Light
          `
        : html`
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            Dark
          `}
    </button>
  `;
}

function Loading() {
  return html`
    <div class="loading-indicator">
      <div class="spinner" />
      Loading API specification...
    </div>
  `;
}

function ErrorState({ message }: { message: string }) {
  return html`
    <div class="error-container">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2>Failed to load API spec</h2>
      <p>${message}</p>
      <button class="btn btn-expand" onClick=${() => location.reload()} style="margin-top: 1rem">
        Retry
      </button>
    </div>
  `;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

export function App() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetchSpec()
      .then(setSpec)
      .catch((err) => setError(err instanceof Error ? err.message : "Network error"));
  }, []);

  useEffect(() => {
    if (!spec) return;
    const content = document.getElementById("endpoints");
    if (!content) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            setActiveId(card.id);
            break;
          }
        }
      },
      { threshold: 0.5, rootMargin: "-80px 0px -60% 0px" },
    );

    const cards = content.querySelectorAll(".endpoint-card");
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [spec]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        setActiveId(decodeURIComponent(hash));
        const el = document.getElementById(decodeURIComponent(hash));
        if (el) {
          setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }
      }
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, [spec]);

  const groups = useMemo(() => (spec ? groupEndpoints(spec) : []), [spec]);

  const handleNavigate = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return html`
    <div class="app-layout">
      ${spec && html`<${Sidebar} groups=${groups} activeId=${activeId} onNavigate=${handleNavigate} />`}
      <main class="main-content">
        <header class="content-header">
          <h1>${spec?.info?.title || "API Documentation"}</h1>
          <${ThemeToggle} />
        </header>
        <div class="endpoints-container" id="endpoints">
          ${error
            ? html`<${ErrorState} message=${error} />`
            : !spec
              ? html`<${Loading} />`
              : groups.map((group) =>
                  html`
                    <div class="endpoint-section" key=${group.tag}>
                      <h2 class="section-title">${capitalize(group.tag)}</h2>
                      ${group.paths.map((item) =>
                        html`
                          <${EndpointCard}
                            key=${`${item.method}-${item.path}`}
                            path=${item.path}
                            method=${item.method}
                            operation=${item.operation}
                          />
                        `,
                      )}
                    </div>
                  `,
                )}
        </div>
      </main>
    </div>
  `;
}
