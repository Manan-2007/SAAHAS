import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LanguageCode } from '../types';
import { DICTIONARIES, ENGLISH, StringKey } from './strings';

// The chosen language, from the first screen onward. Before sign-in it lives
// in sessionStorage (cleared by Quick Exit and when the browser closes, like
// the token); after sign-in the account's language takes over.

const LANG_KEY = 'sahaas_lang';

function initialLanguage(): LanguageCode {
  try {
    const saved = sessionStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'hi' || saved === 'pa') return saved;
  } catch {
    /* storage blocked: default below */
  }
  return 'en';
}

type Vars = Record<string, string | number>;

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: StringKey, vars?: Vars) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    try {
      sessionStorage.setItem(LANG_KEY, next);
    } catch {
      /* kept in memory for this visit */
    }
  }, []);

  // Screen readers and the browser's line-breaking both need the real language.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: StringKey, vars?: Vars) => {
      let text: string = DICTIONARIES[language][key] ?? ENGLISH[key];
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
      return text;
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within <LanguageProvider>');
  return ctx;
}

/** Shorthand for components that only need strings. */
export function useT() {
  return useLanguage().t;
}
