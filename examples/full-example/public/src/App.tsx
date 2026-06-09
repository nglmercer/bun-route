import { h } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { html } from "htm/preact";
import { fetchSpec, groupEndpoints } from "./api/spec";
import type { OpenApiSpec } from "./api/spec";
import { Sidebar } from "./components/Sidebar";
import { EndpointCard } from "./components/EndpointCard";
import { I18nProvider, useI18n } from "./i18n/context";

type Theme = "dark" | "light";
const ALL_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;
type MethodType = (typeof ALL_METHODS)[number];

function getStoredTheme(): Theme {
  return localStorage.getItem("theme") === "light" ? "light" : "dark";
}

function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  return html`
    <button class="theme-toggle" onClick=${() => setTheme((t) => (t === "dark" ? "light" : "dark"))} aria-label=${t.theme.toggle}>
      ${theme === "dark" ? t.theme.dark : t.theme.light}
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

function MethodFilterBar({
  activeMethods,
  onToggle,
  counts,
}: {
  activeMethods: Set<string>;
  onToggle: (m: string) => void;
  counts: Record<string, number>;
}) {
  const { t } = useI18n();
  return html`
    <div class="method-filter-bar">
      <button
        class=${`method-filter-chip ${activeMethods.size === 0 ? "active" : ""}`}
        onClick=${() => onToggle("all")}
      >
        ${t.filter.all}
      </button>
      ${ALL_METHODS.map(
        (m) => html`
          <button
            key=${m}
            class=${`method-filter-chip method-filter-${m} ${activeMethods.has(m) ? "active" : ""}`}
            onClick=${() => onToggle(m)}
          >
            ${m.toUpperCase()}${counts[m] ? html`<span class="method-filter-count">${counts[m]}</span>` : null}
          </button>
        `,
      )}
    </div>
  `;
}

function Loading() {
  const { t } = useI18n();
  return html`<div class="loading-indicator"><div class="spinner" /> ${t.loading}</div>`;
}

function ErrorState({ message }: { message: string }) {
  const { t } = useI18n();
  return html`
    <div class="error-container">
      <h2>${t.error.title}</h2>
      <p>${message}</p>
      <button class="btn btn-expand" onClick=${() => location.reload()} style="margin-top:1rem">${t.error.retry}</button>
    </div>
  `;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function AppContent() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMethods, setActiveMethods] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { t } = useI18n();

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

  const allGroups = useMemo(() => (spec ? groupEndpoints(spec) : []), [spec]);

  const methodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const group of allGroups) {
      for (const item of group.paths) {
        counts[item.method] = (counts[item.method] || 0) + 1;
      }
    }
    return counts;
  }, [allGroups]);

  const toggleMethod = useCallback((method: string) => {
    setActiveMethods((prev) => {
      const next = new Set(prev);
      if (method === "all") {
        return new Set();
      }
      if (next.has(method)) {
        next.delete(method);
      } else {
        next.add(method);
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((tag: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const groups = useMemo(() => {
    let result = allGroups;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result
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
    }
    if (activeMethods.size > 0) {
      result = result
        .map((group) => ({
          ...group,
          paths: group.paths.filter((item) => activeMethods.has(item.method)),
        }))
        .filter((group) => group.paths.length > 0);
    }
    return result;
  }, [allGroups, search, activeMethods]);

  const totalEndpoints = useMemo(() => allGroups.reduce((sum, g) => sum + g.paths.length, 0), [allGroups]);
  const filteredCount = useMemo(() => groups.reduce((sum, g) => sum + g.paths.length, 0), [groups]);

  const handleNavigate = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return html`
    <div class="app-layout">
      <div class=${`sidebar-overlay ${sidebarOpen ? "visible" : ""}`} onClick=${() => setSidebarOpen(false)} />
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
          expandedGroups=${expandedGroups}
          onToggleGroup=${toggleGroup}
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
        <${MethodFilterBar} activeMethods=${activeMethods} onToggle=${toggleMethod} counts=${methodCounts} />
        <div class="endpoints-container" id="endpoints">
          ${error
            ? html`<${ErrorState} message=${error} />`
            : !spec
              ? html`<${Loading} />`
              : groups.length === 0
                ? html`<div class="loading-indicator">${search || activeMethods.size > 0 ? t.common.noEndpointsFiltered : t.common.noEndpoints}</div>`
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

export function App() {
  return html`
    <${I18nProvider}>
      <${AppContent} />
    </${I18nProvider}>
  `;
}
