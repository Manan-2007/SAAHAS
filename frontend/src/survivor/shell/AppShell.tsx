import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { IMMERSIVE } from '../navigation';
import { TopBar } from './TopBar';
import { BottomNav, SideNav } from './Navigation';

/**
 * The room everything happens in. Phones get a single column with the bottom
 * nav; desktops get a centred column beside a quiet rail - never a phone
 * stretched to 1440px. Focused screens (breathing, check-in) put the nav away;
 * Quick Exit stays.
 */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { route } = useSurvivor();
  const { language, t } = useLanguage();
  const immersive = IMMERSIVE.has(route.name);
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Each screen starts at the top, and keyboard / screen-reader users land in
  // it rather than back at the top bar.
  useEffect(() => {
    window.scrollTo(0, 0);
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [route]);

  return (
    <div className="sahaas" lang={language}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-20 focus:left-4 focus:px-4 focus:py-3 focus:rounded-tile focus:bg-ink focus:text-canvas"
      >
        {t('common.skipToContent')}
      </a>
      <TopBar />
      {!immersive && <SideNav />}
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className={`outline-none pt-[calc(4rem+max(0.5rem,env(safe-area-inset-top)))] ${
          immersive ? 'pb-10' : 'pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-16 lg:pl-[248px]'
        }`}
      >
        <div className="mx-auto w-full max-w-[560px] lg:max-w-[680px] px-4 sm:px-6 pt-2">{children}</div>
      </main>
      {!immersive && <BottomNav />}
    </div>
  );
};
