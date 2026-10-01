import React from 'react';
import { useTheme } from '../../theme';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onQuickLock: () => void;
  onToggleNotifications: () => void;
  unreadCount: number;
  live: boolean;
}

const IconButton: React.FC<{ icon: string; label: string; onClick: () => void; id?: string; children?: React.ReactNode }> = ({
  icon,
  label,
  onClick,
  id,
  children,
}) => (
  <button
    id={id}
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className="relative w-9 h-9 rounded-lg grid place-items-center text-ink-2 hover:text-ink hover:bg-raised transition-colors"
  >
    <span className="material-symbols-outlined text-[21px]" aria-hidden>{icon}</span>
    {children}
  </button>
);

/** Quiet by design: whether updates are live, and three icons. The page says what it is. */
export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar, onQuickLock, onToggleNotifications, unreadCount, live }) => {
  const { theme, setPreference } = useTheme();
  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-canvas/90 backdrop-blur-md z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-line">
      <div className="flex items-center gap-3">
        <button
          id="btn-mobile-menu"
          onClick={onToggleMobileSidebar}
          className="lg:hidden w-9 h-9 rounded-lg grid place-items-center text-ink-2 hover:bg-raised"
          aria-label="Open navigation"
          type="button"
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden>menu</span>
        </button>
        <span className="lg:hidden text-[14px] font-extrabold tracking-[0.2em] text-ink">SAAHAS</span>
        <span
          className="hidden lg:inline-flex items-center gap-2 text-[13px] text-ink-2"
          title={live ? 'New check-ins and messages appear as they happen' : 'Reconnecting - the page refreshes every two minutes meanwhile'}
        >
          <span className={`w-2 h-2 rounded-full ${live ? 'bg-ok' : 'bg-ink-3'}`} aria-hidden />
          {live ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <IconButton id="btn-quick-lock" icon="lock" label="Lock the screen" onClick={onQuickLock} />
        <IconButton
          id="btn-theme-toggle"
          icon={theme === 'dark' ? 'light_mode' : 'dark_mode'}
          label={theme === 'dark' ? 'Switch to the light look' : 'Switch to the dark look'}
          onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
        />
        <IconButton id="btn-notifications-toggle" icon="notifications" label={`Alerts${unreadCount ? `, ${unreadCount} new` : ''}`} onClick={onToggleNotifications}>
          {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger ring-2 ring-canvas" aria-hidden />}
        </IconButton>
      </div>
    </header>
  );
};
