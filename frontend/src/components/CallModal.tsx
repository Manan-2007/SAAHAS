import React, { useEffect } from 'react';
import { Phone, X, HeartHandshake } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Real phone lines, one tap each. This used to simulate a call with the
// counsellor, which someone in crisis could mistake for real help.
const LINES = [
  { number: '112', label: 'Emergency', hint: 'Police or ambulance, if you are in danger right now' },
  { number: '14416', label: 'Tele-MANAS', hint: 'Free mental health support, 24x7, in many languages' },
  { number: '181', label: 'Women Helpline', hint: '24x7 support for women facing violence' },
  { number: '14566', label: 'Helpline Against Atrocities', hint: 'Toll-free, for SC/ST atrocity cases' },
];

export const CallModal: React.FC<CallModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#352e24]/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Talk to someone now"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-gradient-to-b from-[#9c6743] to-[#6f4a2f] text-white p-6 shadow-2xl flex flex-col gap-4 border border-[#e7d3b5]/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <HeartHandshake className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold leading-tight">Talk to someone now</h3>
              <p className="text-xs text-[#efe7d6]/90">Every line below is free. Tap to call.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {LINES.map((line) => (
            <a
              key={line.number}
              href={`tel:${line.number}`}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white text-[#352e24] hover:bg-[#efe7d6] active:scale-[0.99] transition-all"
            >
              <span className="w-10 h-10 rounded-full bg-[#9c6743] text-white flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </span>
              <span className="flex-1 flex flex-col">
                <span className="text-sm font-bold">
                  {line.label} · {line.number}
                </span>
                <span className="text-[11px] text-[#5c5142] leading-snug">{line.hint}</span>
              </span>
            </a>
          ))}
        </div>

        {user.counsellor && (
          <p className="text-xs text-[#efe7d6] leading-relaxed bg-white/10 rounded-2xl p-3">
            {user.counsellor} is your counsellor and can see when things are harder for you. If you have their
            number, you can call them too.
          </p>
        )}
      </div>
    </div>
  );
};
