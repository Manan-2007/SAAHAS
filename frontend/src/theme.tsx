import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Light or dark. By default SAHAAS follows the phone; a choice made in the app
// lasts for this browser session only (sessionStorage, like the language), so
// nothing about SAHAAS is left behind on a shared phone and Quick Exit wipes it.
// index.html applies the same rule before first paint, so there's no flash.

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'sahaas_theme';
const QUERY = '(prefers-color-scheme: light)';
const THEME_COLOR: Record<Theme, string> = { dark: '#111111', light: '#f6f2ea' };

function readPreference(): ThemePreference {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* storage blocked: follow the phone */
  }
  return 'system';
}

const systemTheme = (): Theme => (window.matchMedia?.(QUERY).matches ? 'light' : 'dark');

interface ThemeContextValue {
  preference: ThemePreference;
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme: Theme = preference === 'system' ? system : preference;

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setSystem(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      sessionStorage.setItem(KEY, next);
    } catch {
      /* kept for this page only */
    }
  }, []);

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
