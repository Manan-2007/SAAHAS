import React, { useEffect, useRef, useState } from 'react';
import { Wind, X, Leaf, Hand, Eye, Ear, Sparkles } from 'lucide-react';
import type { UiStyle } from '../lib/api';

// Calming elements shared by every victim screen:
//   CalmBackdrop    slow drifting light behind the content
//   BreathingSpace  a "Breathe" button that opens guided breathing and a
//                   5-4-3-2-1 grounding exercise, from anywhere in the app
// Both respect prefers-reduced-motion (index.css) - trauma-informed default.

export const CalmBackdrop: React.FC<{ style: UiStyle }> = ({ style }) => {
  const [a, b] = style === 'warm' ? ['#f3c9d8', '#f7d9c4'] : ['#e7d3b5', '#c9d3e6'];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <div className="calm-aura-a absolute -top-24 -right-28 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-50"
           style={{ backgroundColor: a }} />
      <div className="calm-aura-b absolute top-1/2 -left-32 w-[24rem] h-[24rem] rounded-full blur-3xl opacity-35"
           style={{ backgroundColor: b }} />
    </div>
  );
};

type Phase = 'in' | 'hold' | 'out';
const PHASES: { phase: Phase; seconds: number; label: string }[] = [
  { phase: 'in', seconds: 4, label: 'Breathe in' },
  { phase: 'hold', seconds: 4, label: 'Hold gently' },
  { phase: 'out', seconds: 6, label: 'Breathe out slowly' },
];
const GROUNDING = [
  { n: 5, icon: Eye, text: 'things you can see around you' },
  { n: 4, icon: Hand, text: 'things you can touch - notice how they feel' },
  { n: 3, icon: Ear, text: 'sounds you can hear, near or far' },
  { n: 2, icon: Leaf, text: 'things you can smell, or like the smell of' },
  { n: 1, icon: Sparkles, text: 'kind thing you can say to yourself' },
];

export const BreathingSpace: React.FC<{ style: UiStyle }> = ({ style }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'breathe' | 'ground'>('breathe');
  const [step, setStep] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [groundStep, setGroundStep] = useState(0);
  const timer = useRef<number | null>(null);
  const accent = style === 'warm' ? '#b0587a' : '#9c6743';
  const soft = style === 'warm' ? '#f6e4ec' : '#efe7d6';

  useEffect(() => {
    if (!open || mode !== 'breathe') return;
    const current = PHASES[step];
    timer.current = window.setTimeout(() => {
      const next = (step + 1) % PHASES.length;
      if (next === 0) setRounds((r) => r + 1);
      setStep(next);
    }, current.seconds * 1000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [open, mode, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const start = () => {
    setStep(0);
    setRounds(0);
    setGroundStep(0);
    setMode('breathe');
    setOpen(true);
  };

  const current = PHASES[step];
  const scale = current.phase === 'in' ? 1 : current.phase === 'hold' ? 1 : 0.55;

  return (
    <>
      <button
        onClick={start}
        className="gentle-pulse fixed right-4 bottom-24 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-white text-xs font-semibold shadow-lg active:scale-95 transition-transform"
        style={{ backgroundColor: accent }}
        aria-label="Open a breathing space"
      >
        <Wind className="w-4 h-4" />
        <span>Breathe</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#2b2520]/60 backdrop-blur-md animate-fadeIn"
             role="dialog" aria-modal="true" aria-label="Breathing space">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl flex flex-col items-center gap-5">
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 p-1.5 rounded-lg text-[#8a7d68] hover:bg-[#f5f1e8]"
                    aria-label="Close">
              <X className="w-5 h-5" />
            </button>

            <div className="flex p-1 rounded-2xl text-xs font-semibold" style={{ backgroundColor: soft }}>
              {(['breathe', 'ground'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                        className={`px-4 py-1.5 rounded-xl transition-all ${mode === m ? 'bg-white shadow-xs' : 'text-[#5c5142]'}`}
                        style={mode === m ? { color: accent } : undefined}>
                  {m === 'breathe' ? 'Breathe' : 'Ground yourself'}
                </button>
              ))}
            </div>

            {mode === 'breathe' ? (
              <>
                <div className="relative w-52 h-52 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full opacity-40" style={{ backgroundColor: soft }} />
                  <div
                    className="rounded-full flex items-center justify-center text-white text-sm font-semibold text-center px-4"
                    style={{
                      width: '100%', height: '100%', backgroundColor: accent,
                      transform: `scale(${scale})`,
                      transition: `transform ${current.seconds}s ease-in-out`,
                      opacity: 0.9,
                    }}
                  >
                    {current.label}
                  </div>
                </div>
                <p className="text-xs text-[#5c5142] text-center leading-relaxed">
                  In for 4, hold for 4, out for 6. A longer breath out tells your body it is safe to slow down.
                  {rounds > 0 && <span className="block mt-1 font-semibold" style={{ color: accent }}>
                    {rounds} {rounds === 1 ? 'round' : 'rounds'} done - that's enough, or keep going.</span>}
                </p>
              </>
            ) : (
              <div className="w-full flex flex-col gap-3">
                <p className="text-xs text-[#5c5142] text-center">Slowly, one at a time. There's no hurry.</p>
                {GROUNDING.map((g, i) => {
                  const Icon = g.icon;
                  const done = i < groundStep;
                  const now = i === groundStep;
                  return (
                    <button key={g.n} onClick={() => setGroundStep(i + 1)} disabled={!now}
                            className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${now ? 'ring-2' : ''}`}
                            style={{ backgroundColor: done || now ? soft : '#faf8f3', opacity: done ? 0.6 : 1,
                                     ['--tw-ring-color' as string]: accent }}>
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                            style={{ backgroundColor: accent }}>{g.n}</span>
                      <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
                      <span className="text-sm text-[#352e24]">{g.text}</span>
                    </button>
                  );
                })}
                {groundStep >= GROUNDING.length && (
                  <p className="text-sm font-semibold text-center sparkle-in" style={{ color: accent }}>
                    Well done. You're here, and you're okay in this moment.
                  </p>
                )}
              </div>
            )}

            <button onClick={() => setOpen(false)} className="w-full py-3 rounded-2xl text-white text-sm font-semibold"
                    style={{ backgroundColor: accent }}>
              I feel a little calmer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
