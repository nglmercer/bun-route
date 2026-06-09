import { h } from "preact";
import { html } from "htm/preact";
import type { GroupedEndpoints } from "../api/spec";

interface SidebarProps {
  groups: GroupedEndpoints[];
  activeId: string | null;
  onNavigate: (id: string) => void;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function methodClass(method: string): string {
  return `method-badge method-${method}`;
}

export function Sidebar({ groups, activeId, onNavigate }: SidebarProps) {
  return html`
    <aside class="sidebar" id="sidebar">
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
      <nav class="sidebar-nav">
        ${groups.map((group) =>
          html`
            <div class="sidebar-section" key=${group.tag}>
              <h3 class="sidebar-section-title">${capitalize(group.tag)}</h3>
              <ul class="sidebar-list">
                ${group.paths.map((item) => {
                  const id = `${item.method}-${item.path}`;
                  return html`
                    <li
                      class=${`sidebar-item ${activeId === id ? "active" : ""}`}
                      data-id=${id}
                      key=${id}
                    >
                      <a
                        href="#${id}"
                        class="sidebar-link"
                        onClick=${(e: MouseEvent) => {
                          e.preventDefault();
                          onNavigate(id);
                        }}
                      >
                        <span class=${methodClass(item.method)}>${item.method.toUpperCase()}</span>
                        <span class="sidebar-path"><code>${item.path}</code></span>
                      </a>
                    </li>
                  `;
                })}
              </ul>
            </div>
          `,
        )}
      </nav>
    </aside>
  `;
}
