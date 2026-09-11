import React from 'react';

// A read-only reference for counsellors: how the Distress Score and alerts
// actually work. The numbers mirror backend/monitoring/scoring.py - change
// them there (and here) together.

const WEIGHTS = [
  {
    label: 'Questionnaires',
    weight: 45,
    detail: 'PHQ-9, GAD-7, PC-PTSD-5 and the PHQ-4 pulse from the last 21 days, mapped to 0-100 by clinical band.',
  },
  {
    label: 'Chat distress',
    weight: 25,
    detail: 'The distress model on chat messages from the last 7 days; recent messages count more.',
  },
  {
    label: 'Voice distress',
    weight: 15,
    detail: 'Tone, arousal and valence from voice check-ins and notes in the last 7 days.',
  },
  {
    label: 'Withdrawal',
    weight: 15,
    detail: 'Days since the last contact. No penalty in the first 3 days after sign-up.',
  },
];

const TIERS = [
  { range: '75-100', name: 'High' },
  { range: '50-74', name: 'Elevated' },
  { range: '25-49', name: 'Watch' },
  { range: '0-24', name: 'Stable' },
];

const ALERTS = [
  {
    name: 'Crisis Signal',
    level: 'Crisis',
    when: 'Crisis words or a high-risk distress rating in chat or a voice call, or a PHQ-9 self-harm answer. The score is held at 80 or more for 72 hours.',
  },
  { name: 'High Distress', level: 'High', when: 'The score reaches the High tier. Stays quiet for 24 hours after you resolve it.' },
  { name: 'Rising Distress', level: 'Watch', when: 'Up 15 points or more in 7 days while not Stable. 72-hour cool-down.' },
  {
    name: 'Silent Deterioration',
    level: 'Watch',
    when: 'A long silence while distress is Watch or higher. 72-hour cool-down.',
  },
  {
    name: 'Court Stress',
    level: 'Watch',
    when: 'A case date within 3 days while distress is Elevated or higher. 72-hour cool-down.',
  },
];

const PRIVACY = [
  'Names, phone numbers, case references, answers, saved messages, notes and recordings are encrypted at rest.',
  'Chat text is kept only if the client turns on "Keep what I write"; recordings only if they turn on "Keep recordings".',
  'Passwords are hashed with scrypt. Five wrong attempts start a lockout, and sign-ins expire after 30 days.',
  'A client who deletes their account erases everything, recordings included.',
  'Clients never see scores, severities or clinical labels - only gentle trend words.',
];

const CARD = 'bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-4';
const HEADING = "font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24] flex items-center gap-2";

export const SystemSettingsView: React.FC = () => (
  <div className="flex flex-col space-y-6">
    {/* Header */}
    <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#9c6743] text-[24px]">menu_book</span>
        <h2 className="font-['Plus_Jakarta_Sans'] text-xl text-[#352e24] font-bold">How SAHAAS Scores</h2>
        <span className="px-2.5 py-0.5 rounded-full bg-[#e5dac4] text-[#352e24] font-['Inter'] text-xs font-bold">
          Distress Score v1
        </span>
      </div>
      <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
        A reference for reading the dashboard. The score is recomputed every hour and after every check-in. The weights
        are fixed and not yet clinically validated; they'll be fitted to pilot data.
      </p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className={`lg:col-span-6 ${CARD}`}>
        <h3 className={HEADING}>
          <span className="material-symbols-outlined text-[#9c6743]">tune</span>
          What goes into the score (0-100)
        </h3>
        {WEIGHTS.map((w) => (
          <div key={w.label}>
            <div className="flex justify-between text-xs font-semibold text-[#352e24]">
              <span>{w.label}</span>
              <span className="text-[#9c6743] font-mono">{w.weight}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#efe7d6] mt-1.5 overflow-hidden">
              <div className="h-full bg-[#9c6743] rounded-full" style={{ width: `${w.weight}%` }} />
            </div>
            <p className="text-[11px] text-[#837562] mt-1">{w.detail}</p>
          </div>
        ))}
        <p className="text-[11px] text-[#837562] pt-2 border-t border-[#efe7d6]">
          Signals with no recent data are left out and the rest re-weighted. "Signal coverage" on a case shows how much
          of the score had data.
        </p>

        <h3 className={`${HEADING} pt-2`}>
          <span className="material-symbols-outlined text-[#9c6743]">stacked_bar_chart</span>
          Tiers
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          {TIERS.map((t) => (
            <div key={t.name} className="p-2 rounded-lg bg-[#f5f1e8] border border-[#e5dac4]">
              <span className="block text-xs font-bold text-[#352e24]">{t.name}</span>
              <span className="text-[11px] text-[#837562] font-mono">{t.range}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-6 flex flex-col gap-6">
        <div className={CARD}>
          <h3 className={HEADING}>
            <span className="material-symbols-outlined text-[#ba1a1a]">notifications</span>
            When an alert is raised
          </h3>
          <div className="space-y-2">
            {ALERTS.map((a) => (
              <div key={a.name} className="p-2.5 rounded-lg bg-[#f5f1e8] border border-[#e5dac4]">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-[#352e24]">{a.name}</span>
                  <span className="font-mono text-[#9c6743]">{a.level}</span>
                </div>
                <p className="text-[11px] text-[#5c5142] mt-0.5">{a.when}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#837562]">One open alert per reason at a time. Crisis alerts always refresh.</p>
        </div>

        <div className={CARD}>
          <h3 className={HEADING}>
            <span className="material-symbols-outlined text-[#8a6a4a]">lock</span>
            Data and privacy
          </h3>
          <ul className="space-y-1.5 text-xs text-[#5c5142] list-disc pl-4">
            {PRIVACY.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
);
