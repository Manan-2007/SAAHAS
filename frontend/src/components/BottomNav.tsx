import React from 'react';
import { Home, MessageSquare, Mic, Heart, Handshake } from 'lucide-react';
import { AppView, LanguageCode } from '../types';
import { TRANSLATIONS } from '../data/mockData';

interface BottomNavProps {
  currentView: AppView;
  language: LanguageCode;
  onNavigate: (view: AppView) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  language,
  onNavigate,
}) => {
  const t = TRANSLATIONS[language];

  const isHomeActive = currentView === 'home-dashboard';
  const isChatActive = currentView === 'safe-chat';
  const isVoiceActive = currentView === 'voice-companion';
  const isWellbeingActive = currentView === 'well-being';
  const isSupportActive = currentView === 'support-network' || currentView === 'legal-prep';

  return (
    <nav className="fixed bottom-0 left-0 w-full z-40 pb-safe bg-[#f4faff]/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(38,50,56,0.06)] border-t border-[#ddeaf2]/60">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
        {/* Home */}
        <button
          onClick={() => onNavigate('home-dashboard')}
          aria-label={t.navHome}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 gap-0.5 transition-all focus:outline-none ${
            isHomeActive ? 'text-[#00685d] font-semibold scale-105' : 'text-[#3d4947] hover:text-[#111d23]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight">{t.navHome}</span>
        </button>

        {/* Chat */}
        <button
          onClick={() => onNavigate('safe-chat')}
          aria-label={t.navChat}
          className={`relative flex flex-col items-center justify-center min-w-[56px] h-12 gap-0.5 transition-all focus:outline-none ${
            isChatActive ? 'text-[#00685d] font-semibold scale-105' : 'text-[#3d4947] hover:text-[#111d23]'
          }`}
        >
          <span className="relative flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00685d] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00685d]"></span>
            </span>
          </span>
          <span className="text-[11px] font-medium tracking-tight">{t.navChat}</span>
        </button>

        {/* Voice Companion Center Floating Action Button */}
        <button
          onClick={() => onNavigate('voice-companion')}
          aria-label={t.navVoice}
          className="flex flex-col items-center justify-center -mt-5 focus:outline-none group"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-[0_4px_14px_rgba(0,104,93,0.35)] transition-all group-active:scale-95 ${
            isVoiceActive ? 'bg-[#008376] ring-4 ring-[#a3ede4]' : 'bg-[#00685d] hover:bg-[#008376]'
          }`}>
            <Mic className="w-6 h-6 text-white" />
          </div>
          <span className="text-[11px] font-medium text-[#00685d] mt-1 tracking-tight">{t.navVoice}</span>
        </button>

        {/* Well-being */}
        <button
          onClick={() => onNavigate('well-being')}
          aria-label={t.navWellbeing}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 gap-0.5 transition-all focus:outline-none ${
            isWellbeingActive ? 'text-[#00685d] font-semibold scale-105' : 'text-[#3d4947] hover:text-[#111d23]'
          }`}
        >
          <Heart className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight">{t.navWellbeing}</span>
        </button>

        {/* Support & Legal Prep */}
        <button
          onClick={() => onNavigate('support-network')}
          aria-label={t.navSupport}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 gap-0.5 transition-all focus:outline-none ${
            isSupportActive ? 'text-[#00685d] font-semibold scale-105' : 'text-[#3d4947] hover:text-[#111d23]'
          }`}
        >
          <Handshake className="w-5 h-5" />
          <span className="text-[11px] font-medium tracking-tight">{t.navSupport}</span>
        </button>
      </div>
    </nav>
  );
};
