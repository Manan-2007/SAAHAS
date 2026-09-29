import React from 'react';
import { Phone, ShieldAlert, X } from 'lucide-react';

// Shown when someone mentions threats, pressure to withdraw or ongoing
// harassment. It is not the self-harm crisis banner: it points to protection,
// and tells them their counsellor already knows (the backend raised an alert).
export const SafetyCard: React.FC<{ onDismiss?: () => void; counsellor?: string | null }> = ({ onDismiss, counsellor }) => (
  <div role="alert" className="rounded-2xl bg-[#fff6ec] border border-[#f3cf9f] p-3 flex items-start gap-2.5 text-xs text-[#5a3410]">
    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-[#b86a12]" />
    <div className="flex-1 leading-relaxed">
      <p className="font-semibold">Your safety comes first.</p>
      <p>
        If you or your family are in danger right now, call <strong>112</strong>. Threats and pressure to withdraw a case
        can be reported to the National Helpline Against Atrocities, <strong>14566</strong> (free, 24x7). You have a legal
        right to protection.
      </p>
      <p className="mt-1">{counsellor ? `${counsellor} has been told, so they can help.` : 'Your counsellor has been told, so they can help.'}</p>
      <div className="flex gap-2 mt-2">
        <a href="tel:112" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#b86a12] text-white font-semibold">
          <Phone className="w-3.5 h-3.5" /> 112
        </a>
        <a href="tel:14566" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#f3cf9f] font-semibold">
          <Phone className="w-3.5 h-3.5" /> 14566
        </a>
      </div>
    </div>
    {onDismiss && (
      <button onClick={onDismiss} className="p-1 text-[#5a3410]/60 hover:text-[#5a3410]" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);
