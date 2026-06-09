import "./styles/main.css";
import { fetchSpec, groupEndpoints } from "./api/spec";
import type { OpenApiSpec } from "./api/spec";
import { renderSidebar, highlightActive } from "./components/sidebar";
import { createEndpointCard } from "./components/endpoint";

let currentSpec: OpenApiSpec | null = null;

function getStoredTheme(): string {
  return localStorage.getItem("theme") || "dark";
}

function setTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  const btn = document.querySelector(".theme-toggle") as HTMLButtonElement;
  if (btn) {
    btn.innerHTML =
      theme === "dark"
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark';
  }
}

function toggleTheme(): void {
  setTheme(getStoredTheme() === "dark" ? "light" : "dark");
}

function showLoading(container: HTMLElement): void {
  container.innerHTML = `
    <div class="loading-indicator">
      <div class="spinner"></div>
      Loading API specification...
    </div>
  `;
}

function showError(container: HTMLElement, message: string): void {
  container.innerHTML = `
    <div class="error-container">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h2>Failed to load API spec</h2>
      <p>${message}</p>
      <button class="btn btn-expand" onclick="location.reload()" style="margin-top: 1rem">Retry</button>
    </div>
  `;
}

function renderEndpoints(
  container: HTMLElement,
  spec: OpenApiSpec,
  onNavigate: (id: string) => void,
): void {
  container.innerHTML = "";
  const groups = groupEndpoints(spec);

  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "endpoint-section";

    const title = document.createElement("h2");
    title.className = "section-title";
    title.textContent = group.tag.charAt(0).toUpperCase() + group.tag.slice(1);
    section.appendChild(title);

    for (const item of group.paths) {
      const card = createEndpointCard(item.path, item.method, item.operation);
      section.appendChild(card);

      const observeAndHighlight = () => {
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                const id = `${item.method}-${item.path}`;
                onNavigate(id);
                break;
              }
            }
          },
          { threshold: 0.5, rootMargin: "-80px 0px -60% 0px" },
        );
        observer.observe(card);
      };

      queueMicrotask(observeAndHighlight);
    }

    container.appendChild(section);
  }
}

function setupNavigation(spec: OpenApiSpec): void {
  const sidebar = document.getElementById("sidebar")!;
  const content = document.getElementById("endpoints")!;
  const groups = groupEndpoints(spec);

  renderSidebar(sidebar, groups, (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  const handleHash = () => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      highlightActive(sidebar, decodeURIComponent(hash));
      const el = document.getElementById(decodeURIComponent(hash));
      if (el) {
        setTimeout(
          () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
          100,
        );
      }
    }
  };

  window.addEventListener("hashchange", handleHash);
  handleHash();
}

async function init(): Promise<void> {
  setTheme(getStoredTheme());

  const themeBtn = document.querySelector(".theme-toggle") as HTMLButtonElement;
  themeBtn.addEventListener("click", toggleTheme);

  const content = document.getElementById("endpoints")!;
  showLoading(content);

  try {
    currentSpec = await fetchSpec();
    renderEndpoints(content, currentSpec, (id) => {
      highlightActive(document.getElementById("sidebar")!, id);
    });
    setupNavigation(currentSpec);

    const titleEl = document.querySelector(".content-header h1");
    if (titleEl && currentSpec.info) {
      titleEl.textContent = currentSpec.info.title || "API Documentation";
    }
  } catch (err) {
    showError(content, err instanceof Error ? err.message : "Network error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
