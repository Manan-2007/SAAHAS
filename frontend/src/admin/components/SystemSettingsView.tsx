import React, { useEffect, useState } from 'react';
import { ApiError, TeamMember, api } from '../../lib/api';
import { MIN_PASSWORD_LENGTH } from '../../auth/authStore';
import { PageHeader, QuietButton } from './PageHeader';

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
        <span aria-hidden className="material-symbols-outlined text-sun">contact_phone</span>
        Your contact card (what clients see)
      </h3>
      <p className="text-[11px] text-ink-2">
        Shown in the client app under Support → My counsellor, next to “Request a call back” and messages. Use a work
        number, not a personal one.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={phone} onChange={(e) => { setPhone(e.target.value); setState('idle'); }} maxLength={20}
               placeholder="Work phone, e.g. 0120-555-0101" className="px-3 py-2 rounded-lg border border-line text-xs" />
        <input value={hours} onChange={(e) => { setHours(e.target.value); setState('idle'); }} maxLength={120}
               placeholder="Hours, e.g. Mon-Sat 10am-6pm" className="px-3 py-2 rounded-lg border border-line text-xs" />
      </div>
      <button onClick={save} disabled={state === 'saving' || state === 'loading'}
              className="px-3.5 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold disabled:opacity-50">
        {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Save contact card'}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};

const FIELD = 'w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm text-ink';

// There is no public counsellor sign-up: a counsellor account sees survivors'
// scores, so only someone already signed in as a counsellor can add one.
const TeamCard: React.FC = () => {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const load = () => api.team().then(setTeam).catch(() => setTeam([]));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.addCounsellor(name.trim(), username.trim(), password);
      setAdded(`${r.name} can now sign in at ${window.location.origin}/staff as “${r.username}”. Share the password with them in person.`);
      setName(''); setUsername(''); setPassword(''); setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add them. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={HEADING}>
          <span aria-hidden className="material-symbols-outlined text-sun">group</span>
          Team
        </h3>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); setAdded(null); }}
                  className="px-3.5 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold">
            Add a counsellor
          </button>
        )}
      </div>
      <p className="text-xs text-ink-2">Counsellors sign in at <span className="font-mono text-ink">/staff</span>. New sign-ups are shared out so everyone has a similar caseload.</p>
      {team === null ? (
        <p className="text-xs text-ink-2">Loading…</p>
      ) : (
        <ul className="divide-y divide-line">
          {team.map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between text-sm">
              <span className="text-ink font-semibold">{m.name}{m.username && <span className="ml-2 text-xs font-normal text-ink-2">@{m.username}</span>}</span>
              <span className="text-xs text-ink-2">{m.clients} {m.clients === 1 ? 'person' : 'people'}</span>
            </li>
          ))}
        </ul>
      )}
      {added && <p role="status" className="text-xs text-ok">{added}</p>}
      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-line pt-4" noValidate>
          <label className="block text-xs font-semibold text-ink">Their name
            <input className={`${FIELD} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="off" />
          </label>
          <label className="block text-xs font-semibold text-ink">Username they'll sign in with
            <input className={`${FIELD} mt-1`} value={username} onChange={(e) => setUsername(e.target.value)} maxLength={60} required autoCapitalize="none" autoComplete="off" />
          </label>
          <label className="block text-xs font-semibold text-ink">A first password (at least {MIN_PASSWORD_LENGTH} characters)
            <input className={`${FIELD} mt-1`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </label>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !name.trim() || !username.trim() || !password}
                    className="px-3.5 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold disabled:opacity-50">
              {busy ? 'Adding…' : 'Add counsellor'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }}
                    className="px-3.5 py-2 rounded-lg border border-line text-xs font-semibold text-ink">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const CARD = 'bg-surface rounded-tile p-6 border border-line space-y-4';
const HEADING = " text-base font-bold text-ink flex items-center gap-2";

export const SystemSettingsView: React.FC<{ onOpenHowScoring?: () => void }> = ({ onOpenHowScoring }) => (
  <div className="flex flex-col space-y-6">
    <PageHeader
      title="Settings & scoring"
      description="Your team, your contact card, and a reference for reading the dashboard. The score is recomputed every hour and after every check-in; its weights are fixed and not yet clinically validated."
      actions={onOpenHowScoring && <QuietButton icon="help" onClick={onOpenHowScoring}>How scoring works</QuietButton>}
    />

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className={`lg:col-span-6 ${CARD}`}>
        <h3 className={HEADING}>
          <span aria-hidden className="material-symbols-outlined text-sun">tune</span>
          What goes into the score (0-100)
        </h3>
        {WEIGHTS.map((w) => (
          <div key={w.label}>
            <div className="flex justify-between text-xs font-semibold text-ink">
              <span>{w.label}</span>
              <span className="text-sun font-mono">{w.weight}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-raised mt-1.5 overflow-hidden">
              <div className="h-full bg-ink rounded-full" style={{ width: `${w.weight}%` }} />
            </div>
            <p className="text-[11px] text-ink-2 mt-1">{w.detail}</p>
          </div>
        ))}
        <p className="text-[11px] text-ink-2 pt-2 border-t border-line">
          Signals with no recent data are left out and the rest re-weighted. "Signal coverage" on a case shows how much
          of the score had data.
        </p>

        <h3 className={`${HEADING} pt-2`}>
          <span aria-hidden className="material-symbols-outlined text-sun">stacked_bar_chart</span>
          Tiers
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          {TIERS.map((t) => (
            <div key={t.name} className="p-2 rounded-lg bg-canvas border border-line">
              <span className="block text-xs font-bold text-ink">{t.name}</span>
              <span className="text-[11px] text-ink-2 font-mono">{t.range}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-6 flex flex-col gap-6">
        <TeamCard />
        <ContactCard />
        <div className={CARD}>
          <h3 className={HEADING}>
            <span aria-hidden className="material-symbols-outlined text-danger">notifications</span>
            When an alert is raised
          </h3>
          <div className="space-y-2">
            {ALERTS.map((a) => (
              <div key={a.name} className="p-2.5 rounded-lg bg-canvas border border-line">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-ink">{a.name}</span>
                  <span className="font-mono text-sun">{a.level}</span>
                </div>
                <p className="text-[11px] text-ink-2 mt-0.5">{a.when}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-2">One open alert per reason at a time. Crisis alerts always refresh.</p>
        </div>

        <div className={CARD}>
          <h3 className={HEADING}>
            <span aria-hidden className="material-symbols-outlined text-ink-2">lock</span>
            Data and privacy
          </h3>
          <ul className="space-y-1.5 text-xs text-ink-2 list-disc pl-4">
            {PRIVACY.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
);
