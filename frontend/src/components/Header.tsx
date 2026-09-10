import React from 'react';
import { Shield, Lock, Power, UserCheck } from 'lucide-react';
import { AppView, UserPersona, LanguageCode } from '../types';
import { TRANSLATIONS, USER_PROFILE } from '../data/mockData';

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
    <header className="fixed top-0 w-full z-50 pt-safe bg-[#f4faff]/95 backdrop-blur-xl shadow-[0_1px_12px_rgba(38,50,56,0.06)] border-b border-[#ddeaf2]/60">
      <div className="h-20 px-4 max-w-4xl mx-auto flex flex-col justify-center gap-1">
        {/* Top brand & safety bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onNavigate('home-dashboard')} 
              className="flex items-center gap-1.5 focus:outline-none group text-left"
              title="Return to Home"
            >
              <span className="font-headline-md text-xl tracking-tight text-[#00685d] font-bold group-hover:opacity-90">
                {t.appName}
              </span>
            </button>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#a3ede4]/40 text-[#1d6e67] text-xs font-semibold tracking-wide">
              <Lock className="w-3 h-3 text-[#1d6e67]" />
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

            {/* Profile Avatar */}
            <button 
              onClick={() => onNavigate('well-being')}
              className="relative focus:outline-none rounded-full"
              title="View Profile & Wellness"
            >
              <img
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#00685d]/20 hover:ring-[#00685d]/40 transition-all"
                src={USER_PROFILE.avatar}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#6BAF92] rounded-full ring-2 ring-white"></span>
            </button>
          </div>
        </div>

        {/* Sub-bar with View Name & Persona / Language controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-[#111d23] tracking-tight truncate">
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
                className="appearance-none bg-[#e9f6fd] pl-2 pr-6 py-1 rounded-md text-[#111d23] text-xs font-medium outline-none focus:ring-1 focus:ring-[#00685d] cursor-pointer border border-[#ddeaf2]"
              >
                <option value="en">EN</option>
                <option value="hi">हिन्दी</option>
                <option value="pa">ਪੰਜਾਬੀ</option>
              </select>
              <span className="pointer-events-none absolute right-1.5 text-[#3d4947] text-xs">▼</span>
            </div>

            {/* Admin Toggle button */}
            {persona === 'victim' ? (
              <button
                onClick={() => {
                  onPersonaChange('admin');
                  onNavigate('counsellor-command-centre');
                }}
                className="px-2.5 py-1 rounded-md bg-[#d3e6e9] text-[#0d1e21] text-xs font-semibold flex items-center gap-1 hover:bg-[#b7cacd] transition-colors shadow-2xs"
                title="Switch to Counsellor Admin Mode"
              >
                <Shield className="w-3.5 h-3.5 text-[#00685d]" />
                <span className="hidden sm:inline">Admin</span>
                <span className="sm:hidden">Adm</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onPersonaChange('victim');
                  onNavigate('home-dashboard');
                }}
                className="px-2.5 py-1 rounded-md bg-[#a3ede4] text-[#1d6e67] text-xs font-semibold flex items-center gap-1 hover:bg-[#8cf5e4] transition-colors shadow-2xs"
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
