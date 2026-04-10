import { Globe, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useLanguageStore } from '../stores/useLanguageStore';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);
  const isChinese = language === 'zh';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        aria-label={isChinese ? '切换语言' : 'Switch language'}
      >
        <Globe className="h-4 w-4 text-slate-500 transition-colors group-hover:text-blue-500" />
        <span className="hidden sm:inline">{isChinese ? '中文' : 'EN'}</span>
        <Languages className="h-4 w-4 text-slate-400 transition-colors group-hover:text-blue-400" />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="p-2">
              {[
                { id: 'zh' as const, title: '中文', subtitle: 'Simplified Chinese', badge: 'CN' },
                { id: 'en' as const, title: 'English', subtitle: 'US English', badge: 'EN' },
              ].map((option) => {
                const active = option.id === language;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setLanguage(option.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                        active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {option.badge}
                    </div>
                    <div>
                      <div className="font-semibold">{option.title}</div>
                      <div className="text-xs text-slate-500">{option.subtitle}</div>
                    </div>
                    {active ? (
                      <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                        ?
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              {isChinese ? '即时切换，无需刷新' : 'Switch instantly, no refresh needed'}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isOpen ? <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} /> : null}
    </div>
  );
}

export function SimpleLanguageToggle() {
  const { language, setLanguage } = useLanguageStore();
  const isChinese = language === 'zh';

  return (
    <button
      type="button"
      onClick={() => setLanguage(isChinese ? 'en' : 'zh')}
      className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
      aria-label={isChinese ? '切换语言' : 'Switch language'}
    >
      <Globe className="h-4 w-4 text-slate-500 transition-colors group-hover:text-blue-500" />
      <span>{isChinese ? '中文 / EN' : 'EN / 中文'}</span>
    </button>
  );
}

