export type Language = "en" | "es";

export interface Translations {
  theme: {
    toggle: string;
    light: string;
    dark: string;
  };
  sidebar: {
    searchPlaceholder: (total: number) => string;
    noResults: string;
    endpointsCount: (filtered: number, total: number) => string;
  };
  filter: {
    all: string;
  };
  loading: string;
  error: {
    title: string;
    retry: string;
  };
  common: {
    noEndpoints: string;
    noEndpointsFiltered: string;
  };
}

export interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}
