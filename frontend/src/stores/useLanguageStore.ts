import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'zh' | 'en';

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: 'zh',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'x-thread-language' },
  ),
);
