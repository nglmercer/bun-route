import type { GroupedEndpoints } from "../api/spec";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function formatPath(path: string): string {
  return path
    .replace(/:(\w+)/g, "<strong>:$1</strong>")
    .replace(/\*\*/g, "<em>**</em>")
    .replace(/\*/g, "<em>*</em>");
}

function methodClass(method: string): string {
  return `method-badge method-${method}`;
}

export function renderSidebar(
  container: HTMLElement,
  groups: GroupedEndpoints[],
  onNavigate: (id: string) => void
): void {
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "sidebar-header";
  header.innerHTML = `
    <div class="logo">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>API Docs</span>
    </div>
  `;
  container.appendChild(header);

  const nav = document.createElement("nav");
  nav.className = "sidebar-nav";

  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "sidebar-section";

    const sectionTitle = document.createElement("h3");
    sectionTitle.className = "sidebar-section-title";
    sectionTitle.textContent = capitalize(group.tag);
    section.appendChild(sectionTitle);

    const list = document.createElement("ul");
    list.className = "sidebar-list";

    for (const item of group.paths) {
      const li = document.createElement("li");
      li.className = "sidebar-item";
      li.dataset.id = `${item.method}-${item.path}`;

      li.innerHTML = `
        <a href="#${item.method}-${encodeURIComponent(item.path)}" class="sidebar-link">
          <span class="${methodClass(item.method)}">${item.method.toUpperCase()}</span>
          <span class="sidebar-path">${formatPath(item.path)}</span>
        </a>
      `;

      li.addEventListener("click", (e) => {
        e.preventDefault();
        onNavigate(li.dataset.id!);
        container
          .querySelectorAll(".sidebar-item")
          .forEach((el) => el.classList.remove("active"));
        li.classList.add("active");
      });

      list.appendChild(li);
    }

    section.appendChild(list);
    nav.appendChild(section);
  }

  container.appendChild(nav);
}

export function highlightActive(
  container: HTMLElement,
  id: string
): void {
  container.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });
}
