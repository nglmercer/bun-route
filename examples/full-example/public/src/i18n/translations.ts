import type { Language, Translations } from "./types";

export const translations: Record<Language, Translations> = {
  en: {
    theme: {
      toggle: "Toggle theme",
      light: "Light",
      dark: "Dark",
    },
    sidebar: {
      searchPlaceholder: (total: number) => `Search ${total} endpoints...`,
      noResults: "No endpoints found",
      endpointsCount: (filtered: number, total: number) => `${filtered} of ${total} endpoints`,
    },
    filter: {
      all: "All",
    },
    loading: "Loading API specification...",
    error: {
      title: "Failed to load API spec",
      retry: "Retry",
    },
    common: {
      noEndpoints: "No endpoints found",
      noEndpointsFiltered: "No endpoints match the current filters",
    },
  },
  es: {
    theme: {
      toggle: "Cambiar tema",
      light: "Claro",
      dark: "Oscuro",
    },
    sidebar: {
      searchPlaceholder: (total: number) => `Buscar ${total} endpoints...`,
      noResults: "No se encontraron endpoints",
      endpointsCount: (filtered: number, total: number) => `${filtered} de ${total} endpoints`,
    },
    filter: {
      all: "Todos",
    },
    loading: "Cargando especificación de la API...",
    error: {
      title: "Error al cargar la especificación de la API",
      retry: "Reintentar",
    },
    common: {
      noEndpoints: "No se encontraron endpoints",
      noEndpointsFiltered: "No hay endpoints que coincidan con los filtros actuales",
    },
  },
};
