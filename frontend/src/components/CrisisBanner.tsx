import React from 'react';
import { Phone, ShieldCheck, X } from 'lucide-react';

export const DEFAULT_CRISIS_MESSAGE =
  "If you're thinking about harming yourself or you're in danger right now, please reach out immediately: Emergency 112 · Women Helpline 181 · Tele-MANAS 14416 (24x7 mental health support).";

interface CrisisBannerProps {
  message?: string | null;
  onCall: () => void;
  onDismiss?: () => void;
}

// Shown on any crisis: true from the backend (chat, questionnaire, voice call).
// Helplines plus a way to reach the counsellor - never hidden behind a tap.
export const CrisisBanner: React.FC<CrisisBannerProps> = ({ message, onCall, onDismiss }) => (
  <div role="alert" className="rounded-2xl bg-[#fff1ef] border border-[#ffdad6] p-3 flex items-start gap-2.5 text-xs text-[#5c1a14]">
    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#ba1a1a]" />
    <div className="flex-1 leading-relaxed">
      <p>{message || DEFAULT_CRISIS_MESSAGE}</p>
      <button onClick={onCall} className="mt-1.5 inline-flex items-center gap-1 font-semibold text-[#ba1a1a] hover:underline">
        <Phone className="w-3.5 h-3.5" />
        <span>Call your counsellor now</span>
      </button>
    </div>
    {onDismiss && (
      <button onClick={onDismiss} className="p-1 text-[#93000a]/60 hover:text-[#93000a]" title="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);
