import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface I18nState {
  currentLang: string;
  availableLangs: Record<string, { code: string; name: string; flag: string }>;
  translations: Record<string, Record<string, string>>;
  loaded: boolean;

  loadLanguages: () => Promise<void>;
  setLang: (code: string) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  currentLang: 'en',
  availableLangs: {},
  translations: {},
  loaded: false,

  loadLanguages: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/languages/active`);
      if (!res.ok) return;
      const data = await res.json() as Record<string, { code: string; name: string; flag: string; translations: Record<string, string> }>;
      const availableLangs: Record<string, { code: string; name: string; flag: string }> = {};
      const translations: Record<string, Record<string, string>> = {};
      for (const [code, lang] of Object.entries(data)) {
        availableLangs[code] = { code: lang.code, name: lang.name, flag: lang.flag };
        translations[code] = lang.translations;
      }
      const saved = typeof window !== 'undefined' ? localStorage.getItem('openmerch-admin-lang') : null;
      const currentLang = saved && translations[saved] ? saved : 'en';
      set({ availableLangs, translations, loaded: true, currentLang });
    } catch {
      set({ loaded: true });
    }
  },

  setLang: (code: string) => {
    set({ currentLang: code });
    if (typeof window !== 'undefined') {
      localStorage.setItem('openmerch-admin-lang', code);
    }
  },
}));

/**
 * Translation function for admin panel.
 * Returns the translated text or the original key if not found.
 */
export function useT() {
  const currentLang = useI18nStore((s) => s.currentLang);
  const translations = useI18nStore((s) => s.translations);

  return (key: string): string => {
    if (currentLang === 'en') return key;
    const langTranslations = translations[currentLang];
    if (!langTranslations) return key;
    return langTranslations[key] || key;
  };
}
