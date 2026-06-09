import { h } from "preact";
import { html } from "htm/preact";
import type { GroupedEndpoints } from "../api/spec";

interface SidebarProps {
  groups: GroupedEndpoints[];
  activeId: string | null;
  onNavigate: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  open: boolean;
  totalEndpoints: number;
  filteredCount: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function SearchIcon() {
  return html`
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  `;
}

export function Sidebar({
  groups,
  activeId,
  onNavigate,
  search,
  onSearch,
  open,
  totalEndpoints,
  filteredCount,
}: SidebarProps) {
  const hasResults = groups.some((g) => g.paths.length > 0);

  return html`
    <aside class=${`sidebar ${open ? "open" : ""}`} id="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>API Docs</span>
        </div>
      </div>
      <div class="search-wrapper">
        <${SearchIcon} />
        <input
          class="search-input"
          type="text"
          placeholder=${`Search ${totalEndpoints} endpoints...`}
          value=${search}
          onInput=${(e: Event) => onSearch((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <nav class="sidebar-nav">
        ${!hasResults && search
          ? html`<div class="sidebar-no-results">No endpoints match<br /><strong>"${search}"</strong></div>`
          : groups.map(
              (group) => html`
                <div class="sidebar-section" key=${group.tag}>
                  <h3 class="sidebar-section-title">
                    ${capitalize(group.tag)}
                    <span class="sidebar-count">${group.paths.length}</span>
                  </h3>
                  <ul class="sidebar-list">
                    ${group.paths.map(
                      (item) => html`
                        <li
                          class=${`sidebar-item ${activeId === item.safeId ? "active" : ""}`}
                          key=${item.safeId}
                        >
                          <a
                            href=${`#${item.safeId}`}
                            class="sidebar-link"
                            onClick=${(e: MouseEvent) => {
                              e.preventDefault();
                              onNavigate(item.safeId);
                            }}
                          >
                            <span class=${`method-badge method-${item.method}`}>${item.method.toUpperCase()}</span>
                            <span class="sidebar-path"><code>${item.path}</code></span>
                          </a>
                        </li>
                      `,
                    )}
                  </ul>
                </div>
              `,
            )}
      </nav>
    </aside>
  `;
}
