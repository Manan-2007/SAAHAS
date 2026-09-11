import React from 'react';
import { NavigationTab } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const BRAND_LOGO_URL =
  'https://lh3.googleusercontent.com/aida/AEtjO1VEyAdYi5Yksnru_1OPhZWlg32VyMC0WRPb4X8Naj0MQOI-8GTGIf1Mx6rXvVJWsTNdlrdTv96zLXRdSrcTP6VtrfmngLPaP3j2DhTlNYBF-xw1BYXZs0Q-uuKtD6UTqmrSM8Slh_orJ2lYlKMLzEPUoPI1J0L_5py49yNtv1tcmxxrnD0MjPETL0amsM-j7HUx7DnUF8JelwHSzUIcbDfU3NBsR-yIc9bGj_EiGAkrrfGdiSyqC9brAYA';

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems: { id: NavigationTab; label: string; icon: string; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'grid_view' },
    { id: 'priority-cases', label: 'Priority Cases', icon: 'emergency', badge: '4 High' },
    { id: 'case-detail-signals', label: 'Case Detail & Signals', icon: 'neurology' },
    { id: 'interventions', label: 'Interventions', icon: 'health_and_safety' },
    { id: 'recovery-outcomes', label: 'Recovery & Outcomes', icon: 'trending_up' },
    { id: 'system-settings', label: 'System Settings', icon: 'settings' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="main-sidebar"
        className={`fixed left-0 top-0 h-full w-72 bg-white z-40 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-[#ece2ce] transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo & Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between gap-2 border-b border-[#efe7d6]">
            <div className="flex items-center gap-2.5">
              <img
                src={BRAND_LOGO_URL}
                alt="SAHAAS Care & Counsel logo"
                className="h-8 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="font-['Plus_Jakarta_Sans'] text-lg text-[#9c6743] font-bold tracking-tight leading-tight">
                  SAHAAS
                </span>
                <span className="font-['Inter'] text-[11px] text-[#837562] uppercase tracking-wider font-semibold">
                  Care & Counsel
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-[#efe7d6] px-2.5 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#9c6743] animate-pulse"></span>
              <span className="font-['Inter'] text-[11px] text-[#8a6a4a] font-semibold">
                Secure
              </span>
            </div>
          </div>

          {/* Clinical Protocol Badge */}
          <div className="px-4 py-3">
            <div className="bg-[#efe7d6] rounded-lg p-2.5 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#9c6743] text-[20px]">
                verified_user
              </span>
              <div className="flex flex-col">
                <span className="font-['Inter'] text-[11px] text-[#352e24] font-semibold">
                  Distress Score v1
                </span>
                <span className="font-['Inter'] text-[11px] text-[#837562]">
                  Personal data encrypted at rest
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-4 space-y-1 mt-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-[14px] font-['Inter'] text-left ${
                    isActive
                      ? 'bg-[#b3654a] text-white font-semibold shadow-xs'
                      : 'text-[#5c5142] hover:bg-[#e5dac4] hover:text-[#352e24]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`font-['Inter'] text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#ffdad6] text-[#93000a]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Explainable AI Note */}
        <div className="p-4 space-y-2 bg-[#efe7d6]/70 m-4 rounded-xl border border-[#e5dac4]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#8a6a4a] text-[20px]">
              auto_awesome
            </span>
            <div className="flex flex-col">
              <span className="font-['Inter'] text-[11px] text-[#352e24] font-semibold">
                Explainable AI
              </span>
              <span className="font-['Inter'] text-[11px] text-[#837562]">
                Rules you can read
              </span>
            </div>
          </div>
          <p className="font-['Plus_Jakarta_Sans'] text-[12px] text-[#5c5142] leading-relaxed">
            Scores use only what the client consented to: check-ins, chat and voice. See How SAHAAS Scores.
          </p>
        </div>
      </aside>
    </>
  );
};
