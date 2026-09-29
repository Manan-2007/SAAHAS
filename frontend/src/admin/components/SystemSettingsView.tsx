import React, { useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/api';

// A read-only reference for counsellors: how the Distress Score and alerts
// actually work. The numbers mirror backend/monitoring/scoring.py - change
// them there (and here) together.

const WEIGHTS = [
  {
    label: 'Questionnaires',
    weight: 40,
    detail: 'PHQ-9, GAD-7, PC-PTSD-5 and the PHQ-4 pulse from the last 21 days (app or phone keypad), mapped to 0-100 by clinical band.',
  },
  {
    label: 'Chat distress',
    weight: 22,
    detail: 'The distress model on every chat message, spoken turn and message to you, last 7 days; recent ones count more.',
  },
  {
    label: 'Voice distress',
    weight: 13,
    detail: 'Tone, arousal and valence from voice check-ins, notes and calls in the last 7 days.',
  },
  {
    label: 'Withdrawal',
    weight: 13,
    detail: 'Days since the last contact and overdue check-ins. No penalty in the first 3 days after sign-up.',
  },
  {
    label: 'Case pressure',
    weight: 12,
    detail: 'A hearing coming closer, repeated adjournments, relief reported as never received, and open serious case problems (a threat, a refused FIR).',
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
  { name: 'Threat / Pressure Reported', level: 'High', when: 'A client mentions or reports threats, pressure to withdraw, or a boycott. Legal steps are in Case Problems.' },
  { name: 'Case Problem Reported', level: 'High', when: 'A serious process problem, e.g. the police refusing the FIR or no notice of a bail hearing.' },
  { name: 'Repeated Distress', level: 'Watch', when: 'Two or more messages rated moderate or high within 24 hours.' },
  { name: 'Missed Check-in · Unreachable', level: 'High', when: 'The automated check-in call went unanswered three times, or its 72-hour window ran out.' },
];

const PRIVACY = [
  'Names, phone numbers, case references, answers, saved messages, notes and recordings are encrypted at rest.',
  'Chat text is kept only if the client turns on "Keep what I write"; recordings only if they turn on "Keep recordings".',
  'Passwords are hashed with scrypt. Five wrong attempts start a lockout, and sign-ins expire after 30 days.',
  'A client who deletes their account erases everything, recordings included.',
  'Clients never see scores, severities or clinical labels - only gentle trend words.',
  'Conversation insights are the model’s own summary (emotions, worries, case problems), written only with the client’s consent; the words themselves are held in memory until summarised, then dropped.',
  'The per-message feed shows how each message was rated, never what it said.',
];

// The card clients see under Support → My counsellor.
const ContactCard: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'saved'>('loading');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.myContactCard().then((c) => { setPhone(c.phone ?? ''); setHours(c.hours ?? ''); setState('idle'); })
      .catch(() => setState('idle'));
  }, []);
  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await api.setMyContactCard(phone.trim() || null, hours.trim() || null);
      setState('saved');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save.");
      setState('idle');
    }
  };
  return (
    <div className={CARD}>
      <h3 className={HEADING}>
        <span className="material-symbols-outlined text-[#9c6743]">contact_phone</span>
        Your contact card (what clients see)
      </h3>
      <p className="text-[11px] text-[#837562]">
        Shown in the client app under Support → My counsellor, next to “Request a call back” and messages. Use a work
        number, not a personal one.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={phone} onChange={(e) => { setPhone(e.target.value); setState('idle'); }} maxLength={20}
               placeholder="Work phone, e.g. 0120-555-0101" className="px-3 py-2 rounded-lg border border-[#e5dac4] text-xs" />
        <input value={hours} onChange={(e) => { setHours(e.target.value); setState('idle'); }} maxLength={120}
               placeholder="Hours, e.g. Mon-Sat 10am-6pm" className="px-3 py-2 rounded-lg border border-[#e5dac4] text-xs" />
      </div>
      <button onClick={save} disabled={state === 'saving' || state === 'loading'}
              className="px-3.5 py-2 rounded-lg bg-[#9c6743] text-white text-xs font-semibold disabled:opacity-50">
        {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Save contact card'}
      </button>
      {error && <p className="text-xs text-[#93000a]">{error}</p>}
    </div>
  );
};

const CARD = 'bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-4';
const HEADING = "font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24] flex items-center gap-2";

export const SystemSettingsView: React.FC = () => (
  <div className="flex flex-col space-y-6">
    {/* Header */}
    <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#9c6743] text-[24px]">menu_book</span>
        <h2 className="font-['Plus_Jakarta_Sans'] text-xl text-[#352e24] font-bold">Settings &amp; how SAHAAS scores</h2>
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
        <ContactCard />
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
