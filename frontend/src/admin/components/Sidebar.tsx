import React from 'react';
import { NavigationTab } from '../types';
import { NAV_GROUPS, NAV_PARENT } from '../nav';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  badges?: Partial<Record<NavigationTab, number>>;
  /** Badges that mean "someone may not be safe" get the alert colour; the rest stay quiet. */
  urgent?: Partial<Record<NavigationTab, boolean>>;
  counsellorName: string;
  onSignOut: () => void;
}

const initials = (name: string) =>
  name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  badges = {},
  urgent = {},
  counsellorName,
  onSignOut,
}) => {
  const current = NAV_PARENT[activeTab] ?? activeTab;
  const go = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const item = (id: NavigationTab, label: string, icon: string) => {
    const on = current === id;
    const count = badges[id] ?? 0;
    return (
      <button
        key={id}
        id={`nav-${id}`}
        type="button"
        onClick={() => go(id)}
        aria-current={on ? 'page' : undefined}
        className={`w-full h-9 flex items-center gap-2.5 px-3 rounded-lg text-[14px] text-left transition-colors ${
          on ? 'bg-raised text-ink font-semibold' : 'text-ink-2 hover:bg-raised hover:text-ink'
        }`}
      >
        <span className={`material-symbols-outlined text-[19px] ${on ? 'text-sun' : ''}`} aria-hidden>{icon}</span>
        <span className="flex-1">{label}</span>
        {count > 0 && (
          <span
            className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center ${
              urgent[id] ? 'bg-danger text-canvas' : 'bg-soft text-ink'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {isOpenMobile && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        id="main-sidebar"
        className={`fixed left-0 top-0 h-full w-64 bg-canvas z-40 flex flex-col border-r border-line transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 flex items-center shrink-0">
          <span className="text-[14px] font-extrabold tracking-[0.2em] text-ink">SAAHAS</span>
          <span className="ml-2 text-[12px] text-ink-2">counsellor</span>
        </div>

        <nav aria-label="Command Centre" className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-5">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label ?? i} className="flex flex-col gap-0.5">
              {group.label && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2/80">{group.label}</p>
              )}
              {group.items.map((n) => item(n.id, n.label, n.icon))}
            </div>
          ))}
        </nav>

        <div className="px-3 pb-3 flex flex-col gap-0.5">
          {item('system-settings', 'Settings & scoring', 'tune')}
        </div>

        <div className="border-t border-line px-4 py-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-sun text-on-accent grid place-items-center text-[13px] font-bold shrink-0" aria-hidden>
            {initials(counsellorName) || 'C'}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-ink truncate">{counsellorName}</span>
            <span className="block text-[12px] text-ink-2">Counsellor</span>
          </span>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="w-9 h-9 rounded-lg grid place-items-center text-ink-2 hover:text-ink hover:bg-raised"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
