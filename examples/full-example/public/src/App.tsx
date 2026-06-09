import { h } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { html } from "htm/preact";
import { fetchSpec, groupEndpoints } from "./api/spec";
import type { OpenApiSpec } from "./api/spec";
import { Sidebar } from "./components/Sidebar";
import { EndpointCard } from "./components/EndpointCard";

type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  return localStorage.getItem("theme") === "light" ? "light" : "dark";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  return html`
    <button
      class="theme-toggle"
      onClick=${() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
    >
      ${theme === "dark" ? "Light" : "Dark"}
    </button>
  `;
}

function Hamburger({ onClick }: { onClick: () => void }) {
  return html`
    <button class="hamburger" onClick=${onClick} aria-label="Toggle menu">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  `;
}

function Loading() {
  return html`<div class="loading-indicator"><div class="spinner" /> Loading API specification...</div>`;
}

function ErrorState({ message }: { message: string }) {
  return html`
    <div class="error-container">
      <h2>Failed to load API spec</h2>
      <p>${message}</p>
      <button class="btn btn-expand" onClick=${() => location.reload()} style="margin-top:1rem">
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
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            setActiveId((entry.target as HTMLElement).id);
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
        const decoded = decodeURIComponent(hash);
        setActiveId(decoded);
        const el = document.getElementById(decoded);
        if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, [spec]);

  const groups = useMemo(() => {
    if (!spec) return [];
    const all = groupEndpoints(spec);
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all
      .map((group) => ({
        ...group,
        paths: group.paths.filter(
          (item) =>
            item.path.toLowerCase().includes(q) ||
            item.method.toLowerCase().includes(q) ||
            (item.operation.summary && item.operation.summary.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.paths.length > 0);
  }, [spec, search]);

  const totalEndpoints = useMemo(() => {
    if (!spec) return 0;
    return groupEndpoints(spec).reduce((sum, g) => sum + g.paths.length, 0);
  }, [spec]);

  const filteredCount = useMemo(() => groups.reduce((sum, g) => sum + g.paths.length, 0), [groups]);

  const handleNavigate = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return html`
    <div class="app-layout">
      <div
        class=${`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
        onClick=${() => setSidebarOpen(false)}
      />
      ${spec && html`
        <${Sidebar}
          groups=${groups}
          activeId=${activeId}
          onNavigate=${handleNavigate}
          search=${search}
          onSearch=${setSearch}
          open=${sidebarOpen}
          totalEndpoints=${totalEndpoints}
          filteredCount=${filteredCount}
        />
      `}
      <main class="main-content">
        <header class="content-header">
          <${Hamburger} onClick=${() => setSidebarOpen((v) => !v)} />
          <h1>${spec?.info?.title || "API Documentation"}</h1>
          <div class="header-actions">
            <${ThemeToggle} />
          </div>
        </header>
        <div class="endpoints-container" id="endpoints">
          ${error
            ? html`<${ErrorState} message=${error} />`
            : !spec
              ? html`<${Loading} />`
              : groups.length === 0 && search
                ? html`<div class="loading-indicator">No endpoints match "${search}"</div>`
                : groups.map(
                    (group) => html`
                      <div class="endpoint-section" key=${group.tag}>
                        <h2 class="section-title">${capitalize(group.tag)}</h2>
                        ${group.paths.map(
                          (item) => html`
                            <${EndpointCard}
                              key=${item.safeId}
                              path=${item.path}
                              method=${item.method}
                              safeId=${item.safeId}
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
