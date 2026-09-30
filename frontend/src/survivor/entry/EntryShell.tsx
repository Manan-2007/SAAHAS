import React from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { clearSession } from '../../lib/api';
import { useTheme } from '../../theme';
import '../survivor.css';

/**
 * Before sign-in there's nothing to hide behind a decoy yet, so "Leave" does
 * what the sign-in screen always did: forget this tab's session and replace
 * the page with an ordinary search, so Back doesn't return here.
 */
export function leaveQuickly() {
  clearSession();
  window.location.replace('https://www.google.com/search?q=weather+today');
}

export const EntryShell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => {
  const { t, language } = useLanguage();
  const { theme, setPreference } = useTheme();
  return (
    <div className="sahaas flex flex-col" lang={language}>
      <header className="safe-top px-4 sm:px-6">
        <div className="h-16 flex items-center">
          <span className="text-[15px] font-extrabold tracking-[0.2em]">{t('app.name')}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
            aria-label={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}
            title={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}
            className="tactile-quiet w-12 h-12 mr-2 inline-flex items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" aria-hidden /> : <Moon className="w-5 h-5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={leaveQuickly}
            aria-label={t('welcome.leaveAria')}
            title={t('welcome.leaveAria')}
            className="tactile-quiet min-h-12 px-3.5 inline-flex items-center gap-1.5 rounded-tile bg-raised border border-line text-ink text-[15px] font-semibold"
          >
            {t('welcome.leave')}
            <X className="w-[18px] h-[18px]" aria-hidden strokeWidth={2.4} />
          </button>
        </div>
      </header>
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 pb-10 ${wide ? 'max-w-[960px]' : 'max-w-[480px]'}`}>{children}</main>
    </div>
  );
};
