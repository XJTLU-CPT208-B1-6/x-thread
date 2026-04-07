import { Languages, Globe } from 'lucide-react';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useT } from '../lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export function LanguageSwitcher() {
  const t = useT();
  const { language, setLanguage } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 shadow-sm"
        aria-label={language === 'zh' ? '切换语言' : 'Switch language'}
      >
        <Globe className="h-4 w-4 text-slate-500 group-hover:text-blue-500 transition-colors" />
        <span className="hidden sm:inline">
          {language === 'zh' ? '中文' : 'EN'}
        </span>
        <Languages className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 z-50 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  setLanguage('zh');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                  language === 'zh'
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  language === 'zh' ? 'bg-blue-100' : 'bg-slate-100'
                }`}>
                  <span className="text-lg">🇨🇳</span>
                </div>
                <div>
                  <div className="font-semibold">中文</div>
                  <div className="text-xs text-slate-500">Simplified Chinese</div>
                </div>
                {language === 'zh' && (
                  <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                  language === 'en'
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  language === 'en' ? 'bg-blue-100' : 'bg-slate-100'
                }`}>
                  <span className="text-lg">🇺🇸</span>
                </div>
                <div>
                  <div className="font-semibold">English</div>
                  <div className="text-xs text-slate-500">US English</div>
                </div>
                {language === 'en' && (
                  <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Languages className="h-3 w-3" />
                <span>{language === 'zh' ? '即时切换，无需刷新' : 'Switch instantly, no refresh needed'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export function SimpleLanguageToggle() {
  const { language, setLanguage } = useLanguageStore();
  const t = useT();

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
      className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 shadow-sm"
      aria-label={language === 'zh' ? '切换语言' : 'Switch language'}
    >
      <Globe className="h-4 w-4 text-slate-500 group-hover:text-blue-500 transition-colors" />
      <span>{language === 'zh' ? '中文 / EN' : 'EN / 中文'}</span>
    </button>
  );
}
