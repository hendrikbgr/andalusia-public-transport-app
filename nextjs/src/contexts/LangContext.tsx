'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getLang, setLang, type Lang } from '@/lib/i18n';

interface LangContextValue {
  lang: Lang;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  toggle: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getLang());

  const toggle = useCallback(() => {
    const next: Lang = lang === 'en' ? 'es' : 'en';
    setLang(next);
    setLangState(next);
    // Update html lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
