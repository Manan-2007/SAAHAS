import React, { useRef, useState } from 'react';
import { CaseData } from '../types';
import { PageHeader, PrimaryButton, QuietButton } from './PageHeader';
import { needsYou } from '../data/live';

// "Today": who needs you, and what to do next. Everything deeper - the care
// plan checklist, the recovery history, every signal - lives on its own page
// (Care plans, Outcomes, the case page), so this one stays calm enough to
// read in a minute.

interface OverviewViewProps {
  cases: CaseData[];
  counsellorName: string;
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  onOpenCase: (caseId: string) => void;
  onOpenScheduleFollowUp: () => void;
  onOpenAuditTrail: () => void;
  onAcknowledgePlan: () => void;
  onSyncBaselines: () => void;
  isSyncing: boolean;
}

const TONE_TEXT: Record<CaseData['statusType'], string> = {
  error: 'text-danger',
  amber: 'text-warn',
  success: 'text-ok',
  info: 'text-ink-2',
};
const TONE_DOT: Record<CaseData['statusType'], string> = {
  error: 'bg-danger',
  amber: 'bg-warn',
  success: 'bg-ok',
  info: 'bg-ink-3',
};
const SIGNAL_TEXT: Record<CaseData['signals'][number]['statusColor'], string> = {
  error: 'text-danger',
  amber: 'text-warn',
  primary: 'text-ink',
  secondary: 'text-ink-2',
};


function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const OverviewView: React.FC<OverviewViewProps> = ({
  cases,
  counsellorName,
  selectedCaseId,
  onSelectCase,
  onOpenCase,
  onOpenScheduleFollowUp,
  onOpenAuditTrail,
  onAcknowledgePlan,
  onSyncBaselines,
  isSyncing,
}) => {
  const active = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  // When the two columns stack, the panel is below the list: bring it into view.
  const pick = (id: string) => {
    onSelectCase(id);
    if (window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const attention = cases.filter(needsYou).length;
  const openAlerts = cases.flatMap((c) => c.interventions).filter((i) => i.id.startsWith('alert-') && i.status === 'Pending').length;
  const waiting = cases.reduce((n, c) => n + c.unreadMessages + c.openRequests, 0);
  const datesSoon = cases.filter((c) => c.signals.some((s) => s.type === 'legal' && s.status === 'High Stress')).length;

  const summary = [
    attention ? `${plural(attention, 'person needs', 'people need')} you first` : 'No one needs urgent attention right now',
    openAlerts ? plural(openAlerts, 'open alert', 'open alerts') : null,
    datesSoon ? `${plural(datesSoon, 'court date', 'court dates')} in the next 3 days` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const stats: { value: number; label: string; tone?: string }[] = [
    { value: cases.length, label: 'people in your care' },
    { value: attention, label: 'need you first', tone: attention ? 'text-danger' : undefined },
    { value: openAlerts, label: 'open alerts', tone: openAlerts ? 'text-warn' : undefined },
    { value: waiting, label: 'messages & call-backs waiting' },
  ];

  const hasAlert = active.alertTitle !== 'No open alerts';
  const acknowledged = acknowledgedId === active.id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting()}, ${counsellorName}`}
        description={summary}
        actions={
          <QuietButton id="btn-sync-baselines" icon="sync" onClick={onSyncBaselines} disabled={isSyncing}>
            {isSyncing ? 'Refreshing…' : 'Refresh'}
          </QuietButton>
        }
      />

      <section aria-label="At a glance" className="grid grid-cols-2 lg:grid-cols-4 rounded-card border border-line bg-surface overflow-hidden">
        {stats.map((s, i) => (
          <div key={s.label} className={`px-5 py-4 ${i > 0 ? 'border-l border-line' : ''} ${i === 2 ? 'max-lg:border-l-0 max-lg:border-t' : ''} ${i === 3 ? 'max-lg:border-t' : ''}`}>
            <p className={`text-[28px] leading-none font-semibold tabular-nums ${s.tone ?? 'text-ink'}`}>{s.value}</p>
            <p className="mt-1.5 text-[13px] text-ink-2">{s.label}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-start">
        {/* Caseload, most urgent first */}
        <section aria-labelledby="caseload-title" className="rounded-card border border-line bg-surface">
          <div className="px-5 pt-4 pb-3 flex items-baseline justify-between gap-3">
            <h2 id="caseload-title" className="text-[16px] font-semibold text-ink">Your caseload</h2>
            <span className="text-[12px] text-ink-2">most urgent first</span>
          </div>
          <ul id="case-queue" className="px-2 pb-2">
            {cases.map((c) => {
              const on = c.id === active.id;
              return (
                <li key={c.id}>
                  <button
                    id={`case-card-${c.id}`}
                    type="button"
                    onClick={() => pick(c.id)}
                    aria-pressed={on}
                    className={`w-full text-left px-3 py-3 rounded-tile flex items-center gap-3 transition-colors ${on ? 'bg-raised' : 'hover:bg-raised/60'}`}
                  >
                    <span className="w-9 h-9 rounded-full bg-soft text-ink grid place-items-center text-[13px] font-bold shrink-0" aria-hidden>
                      {c.initials}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[14px] font-semibold text-ink truncate">{c.name}</span>
                        <span className="text-[12px] text-ink-2 shrink-0">{c.timeAgo}</span>
                      </span>
                      <span className={`mt-0.5 flex items-center gap-1.5 text-[12px] font-medium ${TONE_TEXT[c.statusType]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[c.statusType]}`} aria-hidden />
                        <span className="truncate">{c.status}</span>
                      </span>
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-ink-3" aria-hidden>
                      chevron_right
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-5 py-3 border-t border-line text-[12px] text-ink-2 leading-relaxed">
            Scores help you notice who may need you first. They aren't a diagnosis, and the weights aren't clinically
            validated yet. Clients never see them.
          </p>
        </section>

        {/* The person you picked */}
        <section ref={panel} aria-labelledby="person-title" className="scroll-mt-24 rounded-card border border-line bg-surface p-5 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="person-title" className="text-[20px] font-semibold text-ink leading-tight">
                {active.name} <span className="text-[13px] font-normal text-ink-2">{active.number}</span>
              </h2>
              <p className={`mt-1 flex items-center gap-1.5 text-[13px] font-medium ${TONE_TEXT[active.statusType]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[active.statusType]}`} aria-hidden />
                {active.status}
              </p>
            </div>
            <button type="button" onClick={onOpenAuditTrail} className="text-[12px] text-ink-2 hover:text-ink underline underline-offset-4 shrink-0">
              Case history
            </button>
          </div>

          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-[12px] text-ink-2">Distress score</dt>
              <dd className="mt-1 text-[22px] font-semibold text-ink tabular-nums leading-none">
                {active.wellbeingIndex}
                {active.wellbeingDelta !== '—' && <span className="ml-1.5 text-[12px] font-medium text-ink-2">{active.wellbeingDelta}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-2">Voice</dt>
              <dd className="mt-1 text-[22px] font-semibold text-ink tabular-nums leading-none">{active.fatigueMarker}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-2">Escalation risk</dt>
              <dd className={`mt-1 text-[15px] font-semibold ${active.escalationRisk === 'HIGH' ? 'text-danger' : active.escalationRisk === 'MODERATE' ? 'text-warn' : 'text-ink'}`}>
                {active.escalationRisk.charAt(0) + active.escalationRisk.slice(1).toLowerCase()}
              </dd>
            </div>
          </dl>

          <div className={`rounded-tile border-l-[3px] bg-raised px-4 py-3 ${hasAlert ? (active.statusType === 'error' ? 'border-danger' : 'border-warn') : 'border-line-strong'}`}>
            <p className="text-[14px] font-semibold text-ink">{hasAlert ? active.alertTitle : 'Nothing open'}</p>
            <p className="mt-0.5 text-[13px] text-ink-2 leading-relaxed">{hasAlert ? active.alertDescription : active.keyHighlight}</p>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-ink mb-2">What the score is made of</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {active.signals.map((s) => (
                <li key={s.label} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line text-[13px]" title={s.description}>
                  <span className="text-ink-2 truncate">{s.label}</span>
                  <span className={`font-medium shrink-0 ${SIGNAL_TEXT[s.statusColor]}`}>{s.status}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-ink-2">
              {active.aiConfidencePct}% of signals have recent data
              {active.aiConfidencePct < 50 ? ' - read this score with care.' : '.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <PrimaryButton icon="open_in_new" onClick={() => onOpenCase(active.id)}>
              Open case
            </PrimaryButton>
            <QuietButton id="btn-schedule-followup" icon="event" onClick={onOpenScheduleFollowUp}>
              Schedule follow-up
            </QuietButton>
            {hasAlert && (
              <QuietButton
                id="btn-acknowledge-plan"
                icon={acknowledged ? 'task_alt' : 'check'}
                onClick={() => {
                  setAcknowledgedId(active.id);
                  onAcknowledgePlan();
                }}
                disabled={acknowledged}
              >
                {acknowledged ? 'Alerts acknowledged' : 'Acknowledge alerts'}
              </QuietButton>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
