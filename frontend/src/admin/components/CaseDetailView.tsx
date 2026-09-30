import React, { useCallback, useEffect, useState } from 'react';
import { CaseData } from '../types';
import {
  Alert, ApiError, Entitlement, EntitlementStage, EntitlementStatus, EventKind, Recording, ReliefEntry,
  ScoreComponent, Timeline, VictimDetail, api, fetchAudioUrl,
} from '../../lib/api';
import { REASON_ICONS, REASON_TITLES, timeAgo } from '../data/live';
import { InsightCard, InsightsPanel, ReadingsPanel } from './CaseLivePanels';
import { CaseIssuesView } from './CaseIssuesView';
import { MessageThread } from './InboxView';
import { useLiveEvents } from '../liveBus';
import { CHART, TONE } from '../palette';
import { QuietButton } from './PageHeader';

interface CaseDetailViewProps {
  caseData: CaseData;
  onOpenAuditTrail: () => void;
  onOpenScheduleFollowUp: () => void;
  onOpenAssignCounsellor: () => void;
  /** Called after an alert changes, so the caseload refreshes too. */
  onChanged?: () => void;
  /** Back to the caseload. */
  onBack?: () => void;
}

type Tab = 'Signals' | 'Insights' | 'Readings' | 'Issues' | 'Messages' | 'Timeline' | 'Entitlements' | 'Alerts' | 'Recordings' | 'Consent';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'Signals', label: 'Score', icon: 'monitoring' },
  { id: 'Insights', label: 'Summaries', icon: 'psychology' },
  { id: 'Readings', label: 'Readings', icon: 'forum' },
  { id: 'Issues', label: 'Problems', icon: 'gavel' },
  { id: 'Messages', label: 'Messages', icon: 'mail' },
  { id: 'Timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'Entitlements', label: 'Relief', icon: 'payments' },
  { id: 'Alerts', label: 'Alerts', icon: 'notifications' },
  { id: 'Recordings', label: 'Recordings', icon: 'graphic_eq' },
  { id: 'Consent', label: 'Consent', icon: 'shield' },
];

const COMPONENTS: { key: ScoreComponent; label: string; source: string }[] = [
  { key: 'questionnaires', label: 'Questionnaires', source: 'PHQ-9, GAD-7, PC-PTSD-5, PHQ-4' },
  { key: 'text', label: 'Chat distress', source: 'distress model on chat messages' },
  { key: 'voice', label: 'Voice distress', source: 'voice check-ins and notes' },
  { key: 'engagement', label: 'Withdrawal', source: 'days since contact' },
  { key: 'case_pressure', label: 'Case pressure', source: 'the justice calendar: hearings, relief' },
];

const ENTITLEMENT_STATUS_STYLE: Record<EntitlementStatus, { label: string; color: string; bg: string }> = {
  received: { label: 'Received', ...TONE.ok },
  not_received: { label: 'Not received', ...TONE.danger },
  due: { label: 'Due', ...TONE.warn },
  unknown: { label: 'Unconfirmed', ...TONE.neutral },
};

const rupees = (n: number | null | undefined) =>
  n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`;

const EVENT_KIND_OPTIONS: { value: EventKind; label: string }[] = [
  { value: 'hearing', label: 'Hearing' },
  { value: 'bail_hearing', label: 'Bail hearing' },
  { value: 'parole', label: 'Parole hearing' },
  { value: 'adjournment', label: 'Adjournment' },
  { value: 'trial_end', label: 'Trial verdict' },
  { value: 'chargesheet', label: 'Charge sheet' },
  { value: 'fir', label: 'FIR' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'counselling', label: 'Counselling' },
  { value: 'other', label: 'Other' },
];
// s.15A makes notice to the victim mandatory before these (backend.md §5d).
const NOTICE_KINDS: EventKind[] = ['bail_hearing', 'parole'];

const CONSENTS: { key: keyof VictimDetail['consent']; label: string }[] = [
  { key: 'data_storage', label: 'Store check-ins' },
  { key: 'voice_analysis', label: 'Voice analysis' },
  { key: 'store_messages', label: 'Keep chat messages' },
  { key: 'store_recordings', label: 'Keep voice recordings' },
  { key: 'share_insights', label: 'Share conversation summaries' },
  { key: 'ivrs_calls', label: 'Missed check-in calls' },
];

const STATUS_TEXT: Record<CaseData['statusType'], string> = { error: 'text-danger', amber: 'text-warn', success: 'text-ok', info: 'text-ink-2' };
const STATUS_DOT: Record<CaseData['statusType'], string> = { error: 'bg-danger', amber: 'bg-warn', success: 'bg-ok', info: 'bg-ink-3' };

const GENDER_LABEL: Record<string, string> = { woman: 'Woman', man: 'Man', nonbinary: 'Non-binary', prefer_not: 'Not stated' };

const LEVEL_DOT: Record<Alert['level'], string> = {
  crisis: 'bg-danger ring-danger',
  high: 'bg-warn ring-warn/30',
  watch: 'bg-sun ring-sun/30',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend.");

const CARD = 'bg-surface rounded-tile p-5 border border-line';

// The 30-day Distress Score line (0-100, higher is harder)
const ScoreChart: React.FC<{ timeline: Timeline; forecast?: VictimDetail['forecast'] }> = ({ timeline, forecast }) => {
  const points = timeline.scores;
  if (points.length < 2) {
    return <p className="text-xs text-ink-2">Not enough scores yet for a trend line.</p>;
  }
  const t0 = new Date(points[0].at).getTime();
  const last = points[points.length - 1];
  const tLast = new Date(last.at).getTime();
  // Extend the axis to the forecast peak so the dotted continuation fits.
  const fc = forecast?.peak_on ? { t: new Date(`${forecast.peak_on}T00:00:00`).getTime(), score: forecast.peak_score } : null;
  const span = Math.max(1, (fc ? Math.max(tLast, fc.t) : tLast) - t0);
  const X = (t: number) => ((t - t0) / span) * 600;
  const Y = (s: number) => 120 - (s / 100) * 120;
  const xy = points.map((p) => [X(new Date(p.at).getTime()), Y(p.score)] as const);
  return (
    <svg viewBox="0 0 600 120" className="w-full h-32" preserveAspectRatio="none" role="img" aria-label="Distress Score over 30 days, with forecast">
      {[25, 50, 75].map((y) => (
        <line key={y} x1="0" x2="600" y1={Y(y)} y2={Y(y)} style={{ stroke: CHART.grid }} strokeWidth="1" />
      ))}
      {/* §3: faint per-day chat / voice distress means, under the score line */}
      {(['text_distress', 'voice_distress'] as const).map((m, mi) => {
        const s = timeline.signals?.[m]?.filter((o) => o.mean != null);
        if (!s || s.length < 2) return null;
        const pts = s.map((o) => `${X(new Date(`${o.date}T00:00:00`).getTime())},${Y(o.mean)}`).join(' ');
        return (
          <polyline key={m} points={pts} fill="none" style={{ stroke: mi === 0 ? CHART.text : CHART.voice }}
            strokeWidth="1.2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.85" />
        );
      })}
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" style={{ stroke: CHART.score }} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (p.crisis ? <circle key={i} cx={xy[i][0]} cy={xy[i][1]} r="4" style={{ fill: CHART.crisis }} /> : null))}
      {/* §3: questionnaire submissions as ticks along the bottom axis */}
      {(timeline.questionnaires ?? []).map((q, i) => {
        const x = X(new Date(q.at).getTime());
        return <line key={`q${i}`} x1={x} x2={x} y1="110" y2="120" style={{ stroke: CHART.tick }} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
      })}
      {fc && (
        <>
          <line
            x1={X(tLast)} y1={Y(last.score)} x2={X(fc.t)} y2={Y(fc.score)}
            style={{ stroke: CHART.forecast }} strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke"
          />
          <circle cx={X(fc.t)} cy={Y(fc.score)} r="4.5" fill="none" style={{ stroke: CHART.forecast }} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
};

// One victim's real record: score components, timeline, alerts, recordings, consent.
export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseData,
  onOpenAuditTrail,
  onOpenScheduleFollowUp,
  onOpenAssignCounsellor,
  onChanged,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('Signals');
  const [detail, setDetail] = useState<VictimDetail | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState<{ kind: EventKind; date: string; title: string; notice_given: boolean }>({
    kind: 'hearing', date: '', title: '', notice_given: false,
  });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [relief, setRelief] = useState<ReliefEntry[] | null>(null);
  const [reliefSection, setReliefSection] = useState('');
  const [manualEnt, setManualEnt] = useState<{ stage: EntitlementStage; amount: string; due_on: string }>({
    stage: 'tame', amount: '', due_on: '',
  });

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([api.victim(caseData.id), api.timeline(caseData.id, 30)]);
      setDetail(d);
      setTimeline(t);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, [caseData.id]);

  useEffect(() => {
    setDetail(null);
    setTimeline(null);
    setRecordings(null);
    setPlaying(null);
    load();
  }, [load]);

  // The score, alerts and summary update the moment something happens.
  useLiveEvents((e) => { if (e.victim_id === caseData.id) load(); }, ['score', 'alert', 'insight', 'issue']);

  useEffect(() => {
    if (activeTab !== 'Recordings' || !detail?.consent.store_recordings || recordings) return;
    api.victimRecordings(caseData.id).then(setRecordings).catch((err) => setError(errorText(err)));
  }, [activeTab, detail, recordings, caseData.id]);

  // The SC/ST relief schedule, loaded the first time the Relief tab opens (§5b).
  useEffect(() => {
    if (activeTab !== 'Entitlements' || relief) return;
    api.reliefSchedule().then((r) => setRelief(r.entries)).catch(() => setRelief([]));
  }, [activeTab, relief]);

  useEffect(() => () => {
    if (playing) URL.revokeObjectURL(playing.url);
  }, [playing]);

  const updateAlert = async (alert: Alert, action: 'acknowledge' | 'resolve') => {
    try {
      if (action === 'acknowledge') await api.acknowledgeAlert(alert.id);
      else await api.resolveAlert(alert.id, notes[alert.id]?.trim() || undefined);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    }
  };

  // §5b: mark a relief stage as paid / overdue from the counsellor's side.
  const setEntitlementStatus = async (id: number, status: EntitlementStatus) => {
    try {
      await api.updateEntitlement(id, { status });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    }
  };

  // §5b: create the whole staged relief set from the SC/ST gazette schedule.
  const addReliefFromSchedule = async () => {
    if (!reliefSection) return;
    try {
      await api.addReliefFromSchedule(caseData.id, reliefSection);
      setReliefSection('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    }
  };

  // §5b: manual add, for TAME and anything off-schedule.
  const addManualEntitlement = async () => {
    const amount = manualEnt.amount ? Number(manualEnt.amount) : null;
    try {
      await api.addEntitlement(caseData.id, {
        stage: manualEnt.stage,
        amount: amount != null && !Number.isNaN(amount) ? amount : null,
        due_on: manualEnt.due_on || null,
      });
      setManualEnt({ stage: 'tame', amount: '', due_on: '' });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    }
  };

  // §5d/§3: add a case date (with the s.15A notice flag for bail/parole) or delete one.
  const addCaseEvent = async () => {
    if (!newEvent.date || !newEvent.title.trim()) return;
    try {
      await api.addEvent(caseData.id, {
        kind: newEvent.kind,
        date: newEvent.date,
        title: newEvent.title.trim(),
        ...(NOTICE_KINDS.includes(newEvent.kind) ? { notice_given: newEvent.notice_given } : {}),
      });
      setNewEvent({ kind: 'hearing', date: '', title: '', notice_given: false });
      setShowAddEvent(false);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const removeCaseEvent = async (id: number) => {
    try {
      await api.deleteEvent(id);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const play = async (rec: Recording) => {
    try {
      setPlaying({ id: rec.id, url: await fetchAudioUrl(`/counsellor/victims/${caseData.id}/recordings/${rec.id}/audio`) });
    } catch (err) {
      setError(errorText(err));
    }
  };

  const timelineItems = detail
    ? [
        ...detail.alerts.map((a) => ({
          at: a.at,
          dot: LEVEL_DOT[a.level],
          title: `${REASON_TITLES[a.reason] ?? 'Alert'} (${a.status})`,
          text: a.note ? `${a.message} Note: ${a.note}` : a.message,
        })),
        ...detail.questionnaires.map((q) => ({
          at: q.at,
          dot: 'bg-ink-2 ring-ink-2',
          title: `${q.name} completed`,
          text: `${q.total} / ${q.max_score} · ${q.severity}${q.flags.length ? ` · ${q.flags.join(', ').replace(/_/g, ' ')}` : ''}`,
        })),
        ...detail.events.map((e) => ({
          at: `${e.date}T00:00:00`,
          dot: 'bg-info ring-info/40',
          title: e.title,
          text: e.days_until >= 0 ? `${e.kind} · in ${e.days_until} days` : `${e.kind} · ${-e.days_until} days ago`,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    : [];

  return (
    <div className="flex flex-col space-y-6">
      {/* Who, how they are, and the few things you can do from here */}
      <div>
        {onBack && (
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_back</span>
            Caseload
          </button>
        )}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em] text-ink">
              {caseData.name} <span className="text-[14px] font-normal text-ink-2">{caseData.number}</span>
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
              <span className={`inline-flex items-center gap-1.5 font-medium ${STATUS_TEXT[caseData.statusType]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[caseData.statusType]}`} aria-hidden />
                {caseData.status}
              </span>
              <span aria-hidden>·</span>
              <span>Client since {caseData.registeredDate}</span>
              {detail && (
                <>
                  <span aria-hidden>·</span>
                  <span>Last contact {timeAgo(detail.last_contact_at)}</span>
                  <span aria-hidden>·</span>
                  <span>{detail.language.toUpperCase()}</span>
                </>
              )}
              {detail?.gender && (
                <>
                  <span aria-hidden>·</span>
                  <span>{GENDER_LABEL[detail.gender] ?? detail.gender}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {detail?.phone && (
              <a
                href={`tel:${detail.phone}`}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-ink text-canvas text-[13px] font-semibold hover:bg-ink/90"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>call</span>
                Call
              </a>
            )}
            <QuietButton icon="event" onClick={onOpenScheduleFollowUp}>Schedule follow-up</QuietButton>
            <QuietButton icon="history" onClick={onOpenAuditTrail}>History</QuietButton>
          </div>
        </div>

        <div role="tablist" aria-label="Case sections" className="mt-5 flex gap-5 overflow-x-auto no-scrollbar border-b border-line">
          {TABS.map((tab) => {
            const on = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiveTab(tab.id)}
                className={`-mb-px pb-2.5 pt-1 text-[14px] whitespace-nowrap border-b-2 transition-colors ${
                  on ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger bg-danger/15 border border-danger/30 rounded-tile px-3 py-2">
          {error}
        </p>
      )}

      {!detail || !timeline ? (
        <div className={`${CARD} text-xs text-ink-2`}>Loading this case…</div>
      ) : (
        <>
          {activeTab === 'Signals' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className={`lg:col-span-8 ${CARD} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className=" text-base font-bold text-ink">Distress Score, last 30 days</h3>
                    <p className="text-xs text-ink-2">0-100, higher is harder. Red dots mark crisis signals.</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-raised text-ink text-xs font-bold">
                    {detail.latest ? `${Math.round(detail.latest.score)} · ${detail.latest.tier}` : 'No score yet'}
                  </span>
                </div>
                <ScoreChart timeline={timeline} forecast={detail.forecast} />
                <div className="flex items-center gap-3 flex-wrap text-[10px] text-ink-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-[2.5px] bg-ink rounded-full"></span> Distress Score</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-[2px] border-t-2 border-dashed border-info"></span> Chat distress</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-[2px] border-t-2 border-dashed border-sun"></span> Voice distress</span>
                  <span className="flex items-center gap-1"><span className="w-[2px] h-3 bg-ink"></span> Questionnaire</span>
                  {detail.forecast && <span className="flex items-center gap-1"><span className="w-3 h-[2px] border-t-2 border-dashed border-sun"></span> Forecast</span>}
                </div>
                {detail.forecast ? (
                  <div className="flex items-start gap-2 text-xs text-ink bg-raised/70 border border-line rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-[16px] text-sun mt-0.5">insights</span>
                    <span className="leading-relaxed">
                      <strong>Forecast (dashed):</strong> distress may rise toward{' '}
                      <strong>{Math.round(detail.forecast.peak_score)}/100</strong> around{' '}
                      {new Date(`${detail.forecast.peak_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      {' '}— {detail.forecast.driver}. Reaching out before then is the point.
                    </span>
                  </div>
                ) : null}
                {detail.latest?.crisis && detail.latest.crisis_reasons?.length ? (
                  <p className="text-xs text-danger font-semibold">
                    Crisis signal: {detail.latest.crisis_reasons.join(', ').replace(/_/g, ' ')}
                  </p>
                ) : null}
              </div>

              <div className={`lg:col-span-4 ${CARD} space-y-3`}>
                <h3 className=" text-base font-bold text-ink">What makes up the score</h3>
                {COMPONENTS.map((c) => {
                  const value = detail.latest?.components[c.key];
                  return (
                    <div key={c.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">{c.label}</span>
                        <span className="text-ink-2">{value == null ? 'No data' : `${Math.round(value)}/100`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-raised mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${value != null && value >= 60 ? 'bg-danger' : 'bg-ink'}`}
                          style={{ width: `${value ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ink-2">{c.source}</span>
                      {c.key === 'engagement' && detail.latest?.details?.engagement?.days_since_last_contact != null && (
                        <span className="block text-[10px] font-semibold text-danger mt-0.5">
                          Silent {Math.round(detail.latest.details.engagement.days_since_last_contact)} day
                          {Math.round(detail.latest.details.engagement.days_since_last_contact) === 1 ? '' : 's'} — withdrawal is the
                          highest-risk signal, not the lowest.
                        </span>
                      )}
                    </div>
                  );
                })}
                <p className="text-[11px] text-ink-2 leading-relaxed pt-1 border-t border-line">
                  {detail.latest
                    ? `${Math.round(detail.latest.confidence * 100)}% of signals had recent data. Weights are fixed and not yet clinically validated.`
                    : 'No check-ins yet.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Signals' && detail.latest_insight && (
            <div className={`${CARD} space-y-2`}>
              <div className="flex items-center justify-between">
                <h3 className=" text-base font-bold text-ink">Latest conversation</h3>
                <button onClick={() => setActiveTab('Insights')} className="text-xs font-semibold text-sun hover:underline">All insights</button>
              </div>
              <InsightCard insight={detail.latest_insight} />
            </div>
          )}

          {activeTab === 'Insights' && (
            <InsightsPanel victimId={caseData.id} name={caseData.name} shares={detail.consent.share_insights !== false} />
          )}

          {activeTab === 'Readings' && <ReadingsPanel victimId={caseData.id} />}

          {activeTab === 'Issues' && (
            <CaseIssuesView victimId={caseData.id} clients={[{ id: caseData.id, name: caseData.name }]} onOpenCase={() => {}} />
          )}

          {activeTab === 'Messages' && (
            <div className={`${CARD} space-y-3`}>
              <h3 className=" text-base font-bold text-ink">Messages with {caseData.name}</h3>
              <MessageThread victimId={caseData.id} victimName={caseData.name} compact />
            </div>
          )}

          {activeTab === 'Timeline' && (
            <div className="space-y-4">
              {/* §5d/§3: add a case date (with s.15A notice for bail/parole) or delete one */}
              <div className={`${CARD} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className=" text-base font-bold text-ink">Case dates</h3>
                  <button
                    onClick={() => setShowAddEvent((v) => !v)}
                    className="text-xs font-semibold text-sun hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">{showAddEvent ? 'close' : 'add'}</span>
                    {showAddEvent ? 'Cancel' : 'Add a date'}
                  </button>
                </div>

                {showAddEvent && (
                  <div className="rounded-tile border border-line bg-canvas p-3 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={newEvent.kind}
                        onChange={(e) => setNewEvent((s) => ({ ...s, kind: e.target.value as EventKind }))}
                        className="px-2.5 py-2 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                      >
                        {EVENT_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input
                        type="date" value={newEvent.date}
                        onChange={(e) => setNewEvent((s) => ({ ...s, date: e.target.value }))}
                        className="px-2.5 py-2 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                      />
                      <input
                        type="text" value={newEvent.title} maxLength={200}
                        onChange={(e) => setNewEvent((s) => ({ ...s, title: e.target.value }))}
                        placeholder="e.g. District court, room 4"
                        className="px-2.5 py-2 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                      />
                    </div>
                    {NOTICE_KINDS.includes(newEvent.kind) && (
                      <label className="flex items-start gap-2 text-xs text-ink-2 bg-surface rounded-lg border border-danger/40 p-2.5">
                        <input
                          type="checkbox" checked={newEvent.notice_given}
                          onChange={(e) => setNewEvent((s) => ({ ...s, notice_given: e.target.checked }))}
                          className="mt-0.5 accent-sun"
                        />
                        <span>
                          <strong>Victim has been given notice (s.15A).</strong> Notice before a bail or parole hearing is
                          mandatory; if it isn't recorded and the hearing is within 7 days, SAHAAS raises a legal alert.
                        </span>
                      </label>
                    )}
                    <button
                      onClick={addCaseEvent}
                      disabled={!newEvent.date || !newEvent.title.trim()}
                      className="px-3.5 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
                    >
                      Add date
                    </button>
                  </div>
                )}

                {detail.events.length === 0 ? (
                  <p className="text-xs text-ink-2">No case dates recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.events.map((ce) => (
                      <div key={ce.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-canvas border border-line">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-ink capitalize">{ce.kind.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-ink-2"> · {ce.title}</span>
                          <p className="text-[11px] text-ink-2">
                            {when(`${ce.date}T00:00:00`).split(',')[0]} · {ce.days_until >= 0 ? `in ${ce.days_until}d` : 'past'}
                          </p>
                        </div>
                        <button
                          onClick={() => removeCaseEvent(ce.id)}
                          className="p-1.5 rounded-lg text-ink-2 hover:text-danger hover:bg-danger/15"
                          title="Delete date"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Merged history: alerts, check-ins and case dates */}
              <div className={`${CARD} space-y-4`}>
                <h3 className=" text-base font-bold text-ink">Alerts, check-ins and case dates</h3>
                {timelineItems.length === 0 ? (
                  <p className="text-xs text-ink-2">Nothing recorded yet.</p>
                ) : (
                  <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-soft pl-8">
                    {timelineItems.map((item, i) => (
                      <div key={i} className="relative">
                        <span className={`absolute -left-8 top-1 w-4 h-4 rounded-full border-2 border-surface ring-2 ${item.dot}`}></span>
                        <span className="text-[11px] text-ink-2 font-mono">{when(item.at)}</span>
                        <h4 className="text-sm font-bold text-ink">{item.title}</h4>
                        <p className="text-xs text-ink-2 mt-0.5">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Entitlements' && (
            <div className={`${CARD} space-y-4`}>
              <div>
                <h3 className=" text-base font-bold text-ink">Relief &amp; entitlements</h3>
                <p className="text-xs text-ink-2 mt-0.5">
                  Staged relief under the SC/ST (PoA) Rules. What the victim reported is shown — a
                  <strong className="text-danger"> not received</strong> answer is the one to chase.
                </p>
              </div>

              {/* §5b: create the whole staged set from the gazette, or add TAME manually */}
              <div className="rounded-tile border border-line bg-canvas p-3 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    value={reliefSection}
                    onChange={(e) => setReliefSection(e.target.value)}
                    className="flex-1 px-2.5 py-2 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                  >
                    <option value="">Add relief from the SC/ST schedule…</option>
                    {(relief ?? []).map((r) => (
                      <option key={r.section} value={r.section}>
                        {r.offence} — ₹{Math.round(r.amount).toLocaleString('en-IN')} ({r.section})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addReliefFromSchedule}
                    disabled={!reliefSection}
                    className="px-3.5 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors shrink-0"
                  >
                    Create staged set
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center pt-1 border-t border-line">
                  <span className="text-[11px] text-ink-2 shrink-0">Or off-schedule:</span>
                  <select
                    value={manualEnt.stage}
                    onChange={(e) => setManualEnt((s) => ({ ...s, stage: e.target.value as EntitlementStage }))}
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                  >
                    {(['tame', 'fir', 'chargesheet', 'conviction', 'trial_end', 'medical_report', 'post_mortem', 'other'] as EntitlementStage[]).map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <input
                    type="number" min="0" value={manualEnt.amount}
                    onChange={(e) => setManualEnt((s) => ({ ...s, amount: e.target.value }))}
                    placeholder="Amount ₹"
                    className="w-28 px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                  />
                  <input
                    type="date" value={manualEnt.due_on}
                    onChange={(e) => setManualEnt((s) => ({ ...s, due_on: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                  />
                  <button
                    onClick={addManualEntitlement}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-line text-ink text-xs font-semibold hover:bg-raised transition-colors shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
              {!detail.entitlements || detail.entitlements.length === 0 ? (
                <p className="text-xs text-ink-2">
                  No relief stages recorded. Add them from the SC/ST relief schedule when the offence is known.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {detail.entitlements.map((e: Entitlement) => {
                    const s = ENTITLEMENT_STATUS_STYLE[e.status];
                    const overdue = e.status === 'not_received';
                    return (
                      <div
                        key={e.id}
                        className={`rounded-tile border p-3.5 ${overdue ? 'border-danger/40 bg-danger/15' : 'border-line bg-canvas'}`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-ink capitalize">{e.stage.replace(/_/g, ' ')}</span>
                              <span className="text-sm font-semibold text-ink">{rupees(e.amount)}</span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
                                {s.label}
                              </span>
                            </div>
                            <p className="text-xs text-ink-2 mt-1">{e.label}</p>
                            <p className="text-[11px] text-ink-2 mt-0.5">
                              {e.due_on ? `Due ${when(`${e.due_on}T00:00:00`).split(',')[0]}` : 'No due date set'}
                              {e.answered_at ? ` · victim answered ${timeAgo(e.answered_at)}` : ' · victim not asked yet'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setEntitlementStatus(e.id, 'received')}
                              className="px-2.5 py-1 rounded-lg bg-ink text-canvas text-[11px] font-semibold hover:bg-ink/90 transition-colors"
                            >
                              Mark paid
                            </button>
                            <button
                              onClick={() => setEntitlementStatus(e.id, 'not_received')}
                              className="px-2.5 py-1 rounded-lg bg-surface text-danger border border-danger/40 text-[11px] font-semibold hover:bg-danger/15 transition-colors"
                            >
                              Overdue
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Alerts' && (
            <div className={`${CARD} space-y-3`}>
              <h3 className=" text-base font-bold text-ink">Alerts</h3>
              {detail.alerts.length === 0 ? (
                <p className="text-xs text-ink-2">No alerts for this case.</p>
              ) : (
                detail.alerts.map((a) => (
                  <div key={a.id} className="p-3 rounded-tile bg-canvas border border-line flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <span
                          className={`material-symbols-outlined text-[18px] ${a.reason === 'bail_no_notice' ? 'text-danger' : a.level === 'crisis' ? 'text-danger' : 'text-sun'}`}
                        >
                          {REASON_ICONS[a.reason] ?? 'notifications'}
                        </span>
                        {REASON_TITLES[a.reason] ?? a.reason} · <span className="uppercase">{a.level}</span>
                      </span>
                      <span className="text-[11px] text-ink-2">{when(a.at)} · {a.status}</span>
                    </div>
                    <p className="text-xs text-ink-2">{a.message}</p>
                    {a.status === 'resolved' ? (
                      <p className="text-[11px] text-ink-2">
                        Resolved by {a.handled_by ?? 'a counsellor'}
                        {a.note ? `: ${a.note}` : ''}
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={notes[a.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                          placeholder="Note, e.g. Called, she is safe"
                          maxLength={2000}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun"
                        />
                        {a.status === 'open' && (
                          <button
                            onClick={() => updateAlert(a, 'acknowledge')}
                            className="px-3 py-1.5 rounded-lg bg-raised hover:bg-soft text-xs font-semibold text-ink"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => updateAlert(a, 'resolve')}
                          className="px-3 py-1.5 rounded-lg bg-ink hover:bg-ink/90 text-xs font-semibold text-canvas"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'Recordings' && (
            <div className={`${CARD} space-y-3`}>
              <h3 className=" text-base font-bold text-ink">Voice recordings</h3>
              {!detail.consent.store_recordings ? (
                <p className="text-xs text-ink-2">
                  {caseData.name} hasn't turned on keeping recordings (it's off by default), so none are stored.
                </p>
              ) : recordings === null ? (
                <p className="text-xs text-ink-2">Loading…</p>
              ) : recordings.length === 0 ? (
                <p className="text-xs text-ink-2">No recordings yet.</p>
              ) : (
                recordings.map((r) => (
                  <div key={r.id} className="p-3 rounded-tile bg-canvas border border-line flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-ink">
                        {r.kind === 'voice_note' ? 'Voice note' : 'Live check-in'} · {when(r.at)}
                        {r.duration_s ? ` · ${Math.round(r.duration_s)}s` : ''}
                        {r.detail?.emotion ? ` · sounded ${r.detail.emotion}` : ''}
                      </span>
                      <button onClick={() => play(r)} className="px-3 py-1 rounded-lg bg-ink text-canvas text-xs font-semibold">
                        Play
                      </button>
                    </div>
                    {r.detail?.transcript && <p className="text-xs text-ink-2 italic">"{r.detail.transcript}"</p>}
                    {playing?.id === r.id && <audio src={playing.url} controls autoPlay className="w-full h-9" />}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'Consent' && (
            <div className={`${CARD} space-y-4`}>
              <h3 className=" text-base font-bold text-ink">What {caseData.name} has agreed to</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CONSENTS.map((c) => {
                  const on = !!detail.consent[c.key];
                  return (
                    <div key={c.key} className="p-3 bg-raised rounded-tile border border-line flex items-center justify-between">
                      <span className="font-semibold text-xs text-ink">{c.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          on ? 'bg-soft text-ink' : 'bg-surface text-ink-2'
                        }`}
                      >
                        {on ? 'On' : 'Off'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-2 leading-relaxed">
                The victim changes these in the app under Privacy &amp; account. Personal data is encrypted at rest, and
                deleting the account erases everything, recordings included.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
