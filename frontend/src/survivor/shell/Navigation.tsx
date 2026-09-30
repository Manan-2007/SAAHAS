import React from 'react';
import { HandHeart, Home, LucideIcon, MessageCircle, Mic, Sprout } from 'lucide-react';
import { useT } from '../../i18n/LanguageProvider';
import type { StringKey } from '../../i18n/strings';
import { useSurvivor } from '../SurvivorContext';
import { TAB_OF, Tab } from '../navigation';

const ITEMS: { tab: Tab; label: StringKey; icon: LucideIcon }[] = [
  { tab: 'home', label: 'nav.home', icon: Home },
  { tab: 'chat', label: 'nav.chat', icon: MessageCircle },
  { tab: 'voice', label: 'nav.voice', icon: Mic },
  { tab: 'wellbeing', label: 'nav.wellbeing', icon: Sprout },
  { tab: 'support', label: 'nav.support', icon: HandHeart },
];

/** Phones and tablets: five tabs, Voice floating in the middle. */
export const BottomNav: React.FC = () => {
  const t = useT();
  const { route, navigate, unreadMessages } = useSurvivor();
  const active = TAB_OF[route.name];

  return (
    <nav aria-label={t('nav.label')} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas/92 backdrop-blur-md border-t border-line safe-bottom">
      <ul className="mx-auto max-w-[560px] grid grid-cols-5 items-end px-1 pt-1.5">
        {ITEMS.map(({ tab, label, icon: Icon }) => {
          const on = active === tab;
          if (tab === 'voice') {
            return (
              <li key={tab} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => navigate('voice')}
                  aria-current={on ? 'page' : undefined}
                  className="group -mt-8 flex flex-col items-center gap-1 min-w-16"
                >
                  <span className="tactile w-[62px] h-[62px] rounded-full bg-lilac text-on-accent grid place-items-center ring-[6px] ring-canvas">
                    <Icon className="w-7 h-7" aria-hidden strokeWidth={2.2} />
                  </span>
                  <span className={`text-[12px] font-semibold leading-none pb-1.5 ${on ? 'text-ink' : 'text-ink-2'}`}>{t(label)}</span>
                </button>
              </li>
            );
          }
          const badge = tab === 'support' && unreadMessages > 0;
          return (
            <li key={tab}>
              <button
                type="button"
                onClick={() => navigate(tab)}
                aria-current={on ? 'page' : undefined}
                className={`relative w-full min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-tile transition-colors duration-200 ${
                  on ? 'text-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <span aria-hidden className={`absolute top-0 h-[3px] w-6 rounded-full transition-opacity duration-300 ${on ? 'bg-ink opacity-100' : 'opacity-0'}`} />
                <span className="relative">
                  <Icon className="w-6 h-6" aria-hidden strokeWidth={on ? 2.3 : 1.9} />
                  {badge && <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-coral ring-2 ring-canvas" />}
                </span>
                <span className="text-[12px] font-semibold leading-none break-soft text-center px-0.5">{t(label)}</span>
                {badge && <span className="sr-only">, {unreadMessages} new</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

/** Desktop: the same five places as a quiet rail, Voice leading. */
export const SideNav: React.FC = () => {
  const t = useT();
  const { route, navigate, unreadMessages } = useSurvivor();
  const active = TAB_OF[route.name];

  return (
    <nav aria-label={t('nav.label')} className="hidden lg:flex fixed left-0 top-16 bottom-0 w-[248px] flex-col gap-1.5 px-5 pt-6 border-r border-line">
      <button
        type="button"
        onClick={() => navigate('voice')}
        aria-current={active === 'voice' ? 'page' : undefined}
        className="tactile mb-4 min-h-14 rounded-card bg-lilac text-on-accent font-semibold text-[16px] flex items-center gap-3 px-4"
      >
        <Mic className="w-6 h-6" aria-hidden />
        {t('nav.voice')}
      </button>
      {ITEMS.filter((i) => i.tab !== 'voice').map(({ tab, label, icon: Icon }) => {
        const on = active === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => navigate(tab)}
            aria-current={on ? 'page' : undefined}
            className={`min-h-12 rounded-tile px-4 flex items-center gap-3 text-[16px] font-semibold transition-colors duration-200 ${
              on ? 'bg-raised text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface'
            }`}
          >
            <Icon className="w-5 h-5" aria-hidden />
            <span className="flex-1 text-left">{t(label)}</span>
            {tab === 'support' && unreadMessages > 0 && (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-coral text-on-accent text-[12px] font-bold grid place-items-center">
                {unreadMessages}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
