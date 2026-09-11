import React from 'react';

interface HeaderProps {
  counsellorName: string;
  onToggleMobileSidebar: () => void;
  onSignOut: () => void;
  onQuickLock: () => void;
  onToggleNotifications: () => void;
  unreadCount: number;
}

const BRAND_LOGO_URL =
  'https://lh3.googleusercontent.com/aida/AEtjO1VEyAdYi5Yksnru_1OPhZWlg32VyMC0WRPb4X8Naj0MQOI-8GTGIf1Mx6rXvVJWsTNdlrdTv96zLXRdSrcTP6VtrfmngLPaP3j2DhTlNYBF-xw1BYXZs0Q-uuKtD6UTqmrSM8Slh_orJ2lYlKMLzEPUoPI1J0L_5py49yNtv1tcmxxrnD0MjPETL0amsM-j7HUx7DnUF8JelwHSzUIcbDfU3NBsR-yIc9bGj_EiGAkrrfGdiSyqC9brAYA';

export const Header: React.FC<HeaderProps> = ({
  counsellorName,
  onToggleMobileSidebar,
  onSignOut,
  onQuickLock,
  onToggleNotifications,
  unreadCount,
}) => {
  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-[#f5f1e8]/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-30 flex items-center justify-between px-4 sm:px-6 border-b border-[#ece2ce]">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mobile menu trigger */}
        <button
          id="btn-mobile-menu"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-[#5c5142] hover:bg-[#ece2ce]"
          title="Toggle Navigation Menu"
          type="button"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <div className="flex items-center gap-2.5">
          <img
            src={BRAND_LOGO_URL}
            alt="SAHAAS Brand Logo"
            className="h-7 w-auto object-contain"
          />
          <span className="font-['Plus_Jakarta_Sans'] text-[18px] text-[#352e24] font-semibold hidden sm:inline-block">
            SAHAAS Command
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 bg-[#e5dac4] text-[#5c5142] px-3 py-1 rounded-full">
          <span className="material-symbols-outlined text-[#9c6743] text-[16px]">lock</span>
          <span className="font-['Inter'] text-[11px] font-medium">Client Confidential Session</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sign out */}
        <button
          id="btn-sign-out"
          onClick={onSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-[#352e24] font-['Inter'] text-[12px] font-semibold transition-colors shadow-xs"
          type="button"
        >
          <span className="material-symbols-outlined text-[#8a6a4a] text-[18px]">logout</span>
          <span className="hidden sm:inline">Sign out</span>
        </button>

        {/* Quick Lock button */}
        <button
          id="btn-quick-lock"
          onClick={onQuickLock}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#e5dac4] hover:bg-[#ffdad6] hover:text-[#93000a] text-[#5c5142] font-['Inter'] text-[12px] font-medium transition-colors"
          type="button"
          title="Confidential Screen Lock"
        >
          <span className="material-symbols-outlined text-[18px]">lock_clock</span>
          <span className="hidden md:inline">Quick Lock</span>
        </button>

        {/* Notifications button */}
        <button
          id="btn-notifications-toggle"
          onClick={onToggleNotifications}
          className="relative p-2 rounded-full hover:bg-[#ece2ce] text-[#5c5142] hover:text-[#352e24] transition-colors"
          type="button"
          title="Clinical Alerts & Notifications"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ba1a1a] ring-2 ring-[#f5f1e8]"></span>
          )}
        </button>

        {/* Doctor profile */}
        <div className="flex items-center gap-2 pl-1 border-l border-[#e5dac4] ml-1">
          <div className="hidden md:flex flex-col text-right">
            <span className="font-['Inter'] text-[12px] text-[#352e24] font-semibold leading-tight">
              {counsellorName}
            </span>
            <span className="font-['Inter'] text-[11px] text-[#837562] leading-tight">
              Counsellor
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#9c6743] flex items-center justify-center text-white shadow-xs">
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
