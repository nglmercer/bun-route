import { h, createContext } from "preact";
import { useContext, useMemo, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { I18nContextValue, Language } from "./types";
import { translations } from "./translations";

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem("language") as Language | null;
    return stored || "en";
  });

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage: (lang: Language) => {
      localStorage.setItem("language", lang);
      setLanguage(lang);
    },
    t: translations[language],
  }), [language]);

  return h(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
