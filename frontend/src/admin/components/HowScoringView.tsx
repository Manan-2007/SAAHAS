import React from 'react';

// Counsellor-facing explainability: exactly how the Dynamic Distress Score is
// built, so an alert can be trusted and acted on. Kept in step with
// backend/monitoring/scoring.py (weights, tiers, crisis floor).

const SIGNALS: { icon: string; label: string; weight: number; window: string; text: string }[] = [
  { icon: 'assignment', label: 'Questionnaires', weight: 40, window: 'last 21 days',
    text: 'PHQ-9, GAD-7, PC-PTSD-5 and the PHQ-4 pulse, mapped onto 0–100 using each instrument’s own clinical bands.' },
  { icon: 'chat', label: 'Chat distress', weight: 22, window: 'last 7 days',
    text: 'The trained MuRIL distress model rates chat messages and voice transcripts for how much distress the words carry.' },
  { icon: 'graphic_eq', label: 'Voice distress', weight: 13, window: 'last 7 days',
    text: 'Negative affect in the voice itself during check-ins — tone and prosody, not the words.' },
  { icon: 'volume_off', label: 'Withdrawal', weight: 13, window: 'ongoing',
    text: 'Going quiet: days since last contact and overdue check-ins. Silence is the strongest early signal, not the weakest.' },
  { icon: 'calendar_month', label: 'Case pressure', weight: 12, window: 'the calendar',
    text: 'The justice system’s calendar: how close the next hearing is, repeated adjournments, and relief the person says never arrived.' },
];

const BANDS: { label: string; range: string; color: string; bg: string }[] = [
  { label: 'Stable', range: '0–24', color: '#9c6743', bg: '#efe7d6' },
  { label: 'Watch', range: '25–49', color: '#8a6a4a', bg: '#e7d3b5' },
  { label: 'Elevated', range: '50–74', color: '#9a5b13', bg: '#f3dcc3' },
  { label: 'High', range: '75–100', color: '#93000a', bg: '#ffdad6' },
];

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-[#e5dac4] shadow-xs p-5 sm:p-6 ${className}`}>{children}</div>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[11px] font-bold uppercase tracking-wider text-[#9c6743]">{children}</span>
);

export const HowScoringView: React.FC = () => (
  <div className="flex flex-col gap-5 max-w-4xl animate-fadeIn font-['Inter']">
    {/* Header */}
    <Card className="flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl bg-[#efe7d6] flex items-center justify-center text-[#9c6743] shrink-0">
        <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
      </div>
      <div>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#352e24]">How SAHAAS scores distress</h1>
        <p className="text-sm text-[#5c5142] mt-1 leading-relaxed max-w-2xl">
          The Dynamic Distress Score is one 0–100 number per person, recomputed after every check-in and measured
          against <strong>their own baseline</strong> — not a population average. It’s a trend over the whole justice
          journey, built only from what the person consented to share. <strong>SAHAAS triages; you decide.</strong>
        </p>
      </div>
    </Card>

    {/* Signals + weights */}
    <Card>
      <Eyebrow>What goes in</Eyebrow>
      <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#352e24] mt-1 mb-4">Five signals, weighted</h2>
      <div className="space-y-3">
        {SIGNALS.map((s) => (
          <div key={s.label} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#efe7d6] flex items-center justify-center text-[#9c6743] shrink-0">
              <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#352e24]">{s.label}</span>
                <span className="text-xs font-semibold text-[#7a5a3f] tabular-nums shrink-0">{s.weight}% · {s.window}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#efe7d6] mt-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-[#9c6743]" style={{ width: `${s.weight * 2}%` }} />
              </div>
              <p className="text-xs text-[#5c5142] mt-1.5 leading-relaxed">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#837562] mt-4 pt-3 border-t border-[#efe7d6] leading-relaxed">
        A missing signal is left out and the remaining weights are renormalized — never guessed. <strong>Confidence</strong> on
        a case is the share of the weight that actually had recent data; a low-confidence score is worth a second look
        before acting.
      </p>
    </Card>

    {/* Bands */}
    <Card>
      <Eyebrow>What it means</Eyebrow>
      <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#352e24] mt-1 mb-4">Four bands</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BANDS.map((b) => (
          <div key={b.label} className="rounded-xl border border-[#e5dac4] p-4 text-center" style={{ backgroundColor: b.bg }}>
            <div className="text-base font-bold" style={{ color: b.color }}>{b.label}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: b.color }}>{b.range}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#837562] mt-4 leading-relaxed">
        Triage by <strong>change</strong>, not just level: a rising trajectory raises an alert even while the number is
        still in “Watch”, so you can reach out before a crisis rather than after it.
      </p>
    </Card>

    {/* Crisis + forecast */}
    <div className="grid md:grid-cols-2 gap-5">
      <Card className="border-[#f3b0ab] bg-[#ffdad6]/20">
        <div className="flex items-center gap-2 text-[#93000a]">
          <span className="material-symbols-outlined text-[22px]">e911_emergency</span>
          <h2 className="font-['Plus_Jakarta_Sans'] text-base font-bold">Crisis is never softened</h2>
        </div>
        <p className="text-xs text-[#5c5142] mt-2 leading-relaxed">
          Any crisis signal in the last 72 hours — PHQ-9 item 9, or a chat/voice message the model or the keyword list
          flags as high-risk — <strong>floors the score at 80</strong>, sets the <strong>crisis</strong> flag, and shows
          the helpline banner (112 · 181 · Tele-MANAS 14416). It runs on the person’s original words, and it cannot be
          weakened by the other signals looking calm.
        </p>
      </Card>
      <Card>
        <div className="flex items-center gap-2 text-[#9c6743]">
          <span className="material-symbols-outlined text-[22px]">insights</span>
          <h2 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">The calendar is the stressor</h2>
        </div>
        <p className="text-xs text-[#5c5142] mt-2 leading-relaxed">
          Court dates are known in advance, so distress around them is forecastable. When a hearing is near, SAHAAS
          projects a <strong>predicted peak</strong> before it happens — a dotted continuation on the timeline and the
          “This Week” list — so a phone call can land before the spike, not after it.
        </p>
      </Card>
    </div>

    {/* Honesty */}
    <Card className="bg-[#efe7d6]/50">
      <Eyebrow>What to hold in mind</Eyebrow>
      <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#352e24] mt-1 mb-3">Honest limits</h2>
      <ul className="space-y-2.5 text-sm text-[#5c5142]">
        {[
          ['balance', 'A transparent starting point, not a clinically validated model. The weights are fixed and documented; with pilot data they can be fitted to predict the next questionnaire result and counsellor-confirmed crises.'],
          ['handshake', 'AI triages and prioritises attention. It never diagnoses, never denies help, and every alert goes to you — the human — to decide.'],
          ['lock', 'Only opt-in signals are used. What a person didn’t consent to share is never scored, and victims never see a number, tier or the word “risk”.'],
          ['diversity_3', 'Known gaps are named, not hidden: some Hindi/Hinglish phrasings of hopelessness, and threats from other people, are under-caught by the model today — the crisis keyword list backs them up, and a human is always in the loop.'],
        ].map(([icon, text]) => (
          <li key={text} className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] text-[#9c6743] mt-0.5 shrink-0">{icon}</span>
            <span className="leading-relaxed">{text}</span>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);
