import { create } from 'zustand';

interface I18nState {
  currentLang: string;
  availableLangs: Record<string, { code: string; name: string; flag: string }>;
  translations: Record<string, Record<string, string>>;
  loaded: boolean;

  loadLanguages: (apiBase: string) => Promise<void>;
  setLang: (code: string) => void;
}

/**
 * i18n state store (current language, loaded translations). Call `loadLanguages(apiBase)` once on
 * mount to populate translations before rendering strings with {@link useT}.
 */
export const useI18nStore = create<I18nState>((set) => ({
  currentLang: 'en',
  availableLangs: {},
  translations: {},
  loaded: false,

  loadLanguages: async (apiBase: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/languages/active`);
      if (!res.ok) return;
      const data = await res.json() as Record<string, { code: string; name: string; flag: string; translations: Record<string, string> }>;
      const availableLangs: Record<string, { code: string; name: string; flag: string }> = {};
      const translations: Record<string, Record<string, string>> = {};
      for (const [code, lang] of Object.entries(data)) {
        availableLangs[code] = { code: lang.code, name: lang.name, flag: lang.flag };
        translations[code] = lang.translations;
      }
      // Try to detect saved language from localStorage
      const saved = typeof window !== 'undefined' ? localStorage.getItem('openmerch-lang') : null;
      const currentLang = saved && translations[saved] ? saved : 'en';
      set({ availableLangs, translations, loaded: true, currentLang });
    } catch {
      set({ loaded: true });
    }
  },

  setLang: (code: string) => {
    set({ currentLang: code });
    if (typeof window !== 'undefined') {
      localStorage.setItem('openmerch-lang', code);
    }
  },
}));

/**
 * Translation function. Returns the translated text or the original if not found.
 * Usage: const t = useT(); t('Add to Cart')
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
