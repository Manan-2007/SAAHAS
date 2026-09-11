import React, { useState } from 'react';
import { Shield, Lock, Power, UserCheck, LogOut, Heart, User } from 'lucide-react';
import { AppView, UserPersona, LanguageCode } from '../types';
import { TRANSLATIONS, USER_PROFILE } from '../data/mockData';
import { useAuth } from '../auth/AuthProvider';

interface HeaderProps {
  currentView: AppView;
  persona: UserPersona;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onPersonaChange: (persona: UserPersona) => void;
  onQuickExit: () => void;
  onNavigate: (view: AppView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  persona,
  language,
  onLanguageChange,
  onPersonaChange,
  onQuickExit,
  onNavigate,
}) => {
  const t = TRANSLATIONS[language];
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = user.name.trim().split(' ')[0] || user.name;
  const initial = firstName.charAt(0).toUpperCase();

  const getViewTitle = () => {
    switch (currentView) {
      case 'home-dashboard':
        return t.homeTitle;
      case 'safe-chat':
        return 'Safe & Confidential Chat';
      case 'voice-companion':
        return 'Gentle Voice Check-in';
      case 'well-being':
        return 'Well-being & Grounding';
      case 'support-network':
        return 'Support Network & Helplines';
      case 'legal-prep':
        return 'Hearing Preparation Guide';
      case 'counsellor-command-centre':
        return 'Counsellor Command Centre';
      default:
        return t.homeTitle;
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-[#f5f1e8]/95 backdrop-blur-xl shadow-[0_1px_12px_rgba(38,50,56,0.06)] border-b border-[#e5dac4]/60">
      <div className="h-20 px-4 max-w-4xl mx-auto flex flex-col justify-center gap-1">
        {/* Top brand & safety bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onNavigate('home-dashboard')} 
              className="flex items-center gap-1.5 focus:outline-none group text-left"
              title="Return to Home"
            >
              <span className="font-headline-md text-xl tracking-tight text-[#9c6743] font-bold group-hover:opacity-90">
                {t.appName}
              </span>
            </button>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e7d3b5]/40 text-[#7a5a3f] text-xs font-semibold tracking-wide">
              <Lock className="w-3 h-3 text-[#7a5a3f]" />
              <span>{t.privateSafe}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Safety Exit button */}
            <button
              id="quick-exit-btn"
              onClick={onQuickExit}
              aria-label="Quick safety exit redirect"
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-[#ffdad6]/80 text-[#93000a] text-xs font-semibold flex items-center gap-1 hover:bg-[#ffdad6] active:scale-95 transition-all shadow-xs"
              type="button"
            >
              <Power className="w-3.5 h-3.5 text-[#ba1a1a]" />
              <span className="whitespace-nowrap">{t.quickExit}</span>
            </button>

            {/* Profile Avatar + menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="relative rounded-full"
                title="Your account"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c8a97e] to-[#9c6743] text-white text-sm font-bold flex items-center justify-center ring-2 ring-[#9c6743]/20 hover:ring-[#9c6743]/40 transition-all">
                  {initial}
                </span>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#9fafca] rounded-full ring-2 ring-white"></span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 z-50 rounded-2xl bg-white border border-[#e5dac4] shadow-lg overflow-hidden animate-fadeIn">
                    <div className="px-4 py-3 border-b border-[#ece2ce]">
                      <p className="text-sm font-bold text-[#352e24] truncate">{user.name}</p>
                      <p className="text-xs text-[#8a7d68] truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('well-being');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#352e24] hover:bg-[#f5f1e8] transition-colors"
                    >
                      <Heart className="w-4 h-4 text-[#9c6743]" />
                      <span>My well-being</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#93000a] hover:bg-[#ffdad6]/40 transition-colors border-t border-[#ece2ce]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sub-bar with View Name & Persona / Language controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-[#352e24] tracking-tight truncate">
              {getViewTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Selector */}
            <div className="relative flex items-center">
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                aria-label="Select language"
                className="appearance-none bg-[#efe7d6] pl-2 pr-6 py-1 rounded-md text-[#352e24] text-xs font-medium outline-none focus:ring-1 focus:ring-[#9c6743] cursor-pointer border border-[#e5dac4]"
              >
                <option value="en">EN</option>
                <option value="hi">हिन्दी</option>
                <option value="pa">ਪੰਜਾਬੀ</option>
              </select>
              <span className="pointer-events-none absolute right-1.5 text-[#5c5142] text-xs">▼</span>
            </div>

            {/* Admin Toggle button */}
            {persona === 'victim' ? (
              <button
                onClick={() => {
                  onPersonaChange('admin');
                  onNavigate('counsellor-command-centre');
                }}
                className="px-2.5 py-1 rounded-md bg-[#e2d6c0] text-[#352e24] text-xs font-semibold flex items-center gap-1 hover:bg-[#cbbda4] transition-colors shadow-2xs"
                title="Switch to Counsellor Admin Mode"
              >
                <Shield className="w-3.5 h-3.5 text-[#9c6743]" />
                <span className="hidden sm:inline">Admin</span>
                <span className="sm:hidden">Adm</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onPersonaChange('victim');
                  onNavigate('home-dashboard');
                }}
                className="px-2.5 py-1 rounded-md bg-[#e7d3b5] text-[#7a5a3f] text-xs font-semibold flex items-center gap-1 hover:bg-[#ecdcbf] transition-colors shadow-2xs"
                title="Return to User View"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>User View</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
