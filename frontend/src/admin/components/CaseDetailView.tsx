import React, { useCallback, useEffect, useState } from 'react';
import { CaseData } from '../types';
import { Alert, ApiError, Recording, ScoreComponent, Timeline, VictimDetail, api, fetchAudioUrl } from '../../lib/api';
import { REASON_TITLES, timeAgo } from '../data/live';

interface CaseDetailViewProps {
  caseData: CaseData;
  onOpenAuditTrail: () => void;
  onOpenScheduleFollowUp: () => void;
  onOpenAssignCounsellor: () => void;
  /** Called after an alert changes, so the caseload refreshes too. */
  onChanged?: () => void;
}

type Tab = 'Signals' | 'Timeline' | 'Alerts' | 'Recordings' | 'Consent';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'Signals', label: 'Score & Signals', icon: 'monitoring' },
  { id: 'Timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'Alerts', label: 'Alerts', icon: 'notifications' },
  { id: 'Recordings', label: 'Recordings', icon: 'graphic_eq' },
  { id: 'Consent', label: 'Consent', icon: 'shield' },
];

const COMPONENTS: { key: ScoreComponent; label: string; source: string }[] = [
  { key: 'questionnaires', label: 'Questionnaires', source: 'PHQ-9, GAD-7, PC-PTSD-5, PHQ-4' },
  { key: 'text', label: 'Chat distress', source: 'distress model on chat messages' },
  { key: 'voice', label: 'Voice distress', source: 'voice check-ins and notes' },
  { key: 'engagement', label: 'Withdrawal', source: 'days since contact' },
];

const CONSENTS: { key: keyof VictimDetail['consent']; label: string }[] = [
  { key: 'data_storage', label: 'Store check-ins' },
  { key: 'voice_analysis', label: 'Voice analysis' },
  { key: 'store_messages', label: 'Keep chat messages' },
  { key: 'store_recordings', label: 'Keep voice recordings' },
];

const LEVEL_DOT: Record<Alert['level'], string> = {
  crisis: 'bg-[#ba1a1a] ring-[#ffdad6]',
  high: 'bg-amber-500 ring-amber-100',
  watch: 'bg-[#9c6743] ring-[#e7d3b5]',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend.");

const CARD = 'bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]';

// The 30-day Distress Score line (0-100, higher is harder)
const ScoreChart: React.FC<{ timeline: Timeline; forecast?: VictimDetail['forecast'] }> = ({ timeline, forecast }) => {
  const points = timeline.scores;
  if (points.length < 2) {
    return <p className="text-xs text-[#837562]">Not enough scores yet for a trend line.</p>;
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
        <line key={y} x1="0" x2="600" y1={Y(y)} y2={Y(y)} stroke="#ece2ce" strokeWidth="1" />
      ))}
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#9c6743" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (p.crisis ? <circle key={i} cx={xy[i][0]} cy={xy[i][1]} r="4" fill="#ba1a1a" /> : null))}
      {fc && (
        <>
          <line
            x1={X(tLast)} y1={Y(last.score)} x2={X(fc.t)} y2={Y(fc.score)}
            stroke="#b3654a" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke"
          />
          <circle cx={X(fc.t)} cy={Y(fc.score)} r="4.5" fill="none" stroke="#b3654a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
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
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('Signals');
  const [detail, setDetail] = useState<VictimDetail | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeTab !== 'Recordings' || !detail?.consent.store_recordings || recordings) return;
    api.victimRecordings(caseData.id).then(setRecordings).catch((err) => setError(errorText(err)));
  }, [activeTab, detail, recordings, caseData.id]);

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
          dot: 'bg-[#8a6a4a] ring-[#e7d3b5]',
          title: `${q.name} completed`,
          text: `${q.total} / ${q.max_score} · ${q.severity}${q.flags.length ? ` · ${q.flags.join(', ').replace(/_/g, ' ')}` : ''}`,
        })),
        ...detail.events.map((e) => ({
          at: `${e.date}T00:00:00`,
          dot: 'bg-[#9fafca] ring-[#dfe5f0]',
          title: e.title,
          text: e.days_until >= 0 ? `${e.kind} · in ${e.days_until} days` : `${e.kind} · ${-e.days_until} days ago`,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    : [];

  return (
    <div className="flex flex-col space-y-6">
      {/* Top Patient Banner */}
      <div className={CARD}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center font-['Plus_Jakarta_Sans'] text-xl font-bold shadow-xs">
              {caseData.initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-['Plus_Jakarta_Sans'] text-2xl text-[#352e24] font-bold">{caseData.name}</h2>
                <span className="font-mono text-xs bg-[#efe7d6] px-2.5 py-1 rounded text-[#837562] font-semibold">
                  {caseData.number}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#ffdad6] text-[#ba1a1a] font-['Inter'] text-xs font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
                  {caseData.status}
                </span>
              </div>
              <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
                Client since {caseData.registeredDate} • Counsellor: {caseData.assignedCounsellor}
                {detail && ` • Language: ${detail.language.toUpperCase()} • Last contact ${timeAgo(detail.last_contact_at)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {detail?.phone && (
              <a
                href={`tel:${detail.phone}`}
                className="px-3 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold flex items-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">phone_in_talk</span>
                <span>Call {detail.phone}</span>
              </a>
            )}
            <button
              type="button"
              onClick={onOpenScheduleFollowUp}
              className="px-3 py-2 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-[#352e24] font-['Inter'] text-xs font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">event</span>
              <span>Schedule follow-up</span>
            </button>
            <button
              type="button"
              onClick={onOpenAssignCounsellor}
              className="px-3 py-2 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-[#352e24] font-['Inter'] text-xs font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              <span>Reassign</span>
            </button>
            <button
              type="button"
              onClick={onOpenAuditTrail}
              className="p-2 rounded-lg bg-[#e5dac4] hover:bg-[#ddd0b8] text-[#5c5142]"
              title="Audit Log"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </button>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <div className="flex items-center gap-2 mt-5 pt-3 border-t border-[#efe7d6] flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Inter'] transition-colors ${
                activeTab === tab.id ? 'bg-[#9c6743] text-white font-semibold shadow-xs' : 'text-[#837562] hover:bg-[#f5f1e8]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#93000a] bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {!detail || !timeline ? (
        <div className={`${CARD} text-xs text-[#837562]`}>Loading this case…</div>
      ) : (
        <>
          {activeTab === 'Signals' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className={`lg:col-span-8 ${CARD} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">Distress Score, last 30 days</h3>
                    <p className="text-xs text-[#837562]">0-100, higher is harder. Red dots mark crisis signals.</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#efe7d6] text-[#7a5a3f] text-xs font-bold">
                    {detail.latest ? `${Math.round(detail.latest.score)} · ${detail.latest.tier}` : 'No score yet'}
                  </span>
                </div>
                <ScoreChart timeline={timeline} forecast={detail.forecast} />
                {detail.forecast ? (
                  <div className="flex items-start gap-2 text-xs text-[#7a5a3f] bg-[#efe7d6]/70 border border-[#e5dac4] rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-[16px] text-[#b3654a] mt-0.5">insights</span>
                    <span className="leading-relaxed">
                      <strong>Forecast (dashed):</strong> distress may rise toward{' '}
                      <strong>{Math.round(detail.forecast.peak_score)}/100</strong> around{' '}
                      {new Date(`${detail.forecast.peak_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      {' '}— {detail.forecast.driver}. Reaching out before then is the point.
                    </span>
                  </div>
                ) : null}
                {detail.latest?.crisis && detail.latest.crisis_reasons?.length ? (
                  <p className="text-xs text-[#ba1a1a] font-semibold">
                    Crisis signal: {detail.latest.crisis_reasons.join(', ').replace(/_/g, ' ')}
                  </p>
                ) : null}
              </div>

              <div className={`lg:col-span-4 ${CARD} space-y-3`}>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">What makes up the score</h3>
                {COMPONENTS.map((c) => {
                  const value = detail.latest?.components[c.key];
                  return (
                    <div key={c.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#352e24]">{c.label}</span>
                        <span className="text-[#837562]">{value == null ? 'No data' : `${Math.round(value)}/100`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#efe7d6] mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${value != null && value >= 60 ? 'bg-[#ba1a1a]' : 'bg-[#9c6743]'}`}
                          style={{ width: `${value ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#837562]">{c.source}</span>
                    </div>
                  );
                })}
                <p className="text-[11px] text-[#837562] leading-relaxed pt-1 border-t border-[#efe7d6]">
                  {detail.latest
                    ? `${Math.round(detail.latest.confidence * 100)}% of signals had recent data. Weights are fixed and not yet clinically validated.`
                    : 'No check-ins yet.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Timeline' && (
            <div className={`${CARD} space-y-4`}>
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">Alerts, check-ins and case dates</h3>
              {timelineItems.length === 0 ? (
                <p className="text-xs text-[#837562]">Nothing recorded yet.</p>
              ) : (
                <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e5dac4] pl-8">
                  {timelineItems.map((item, i) => (
                    <div key={i} className="relative">
                      <span className={`absolute -left-8 top-1 w-4 h-4 rounded-full border-2 border-white ring-2 ${item.dot}`}></span>
                      <span className="text-[11px] text-[#837562] font-mono">{when(item.at)}</span>
                      <h4 className="text-sm font-bold text-[#352e24]">{item.title}</h4>
                      <p className="text-xs text-[#5c5142] mt-0.5">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Alerts' && (
            <div className={`${CARD} space-y-3`}>
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">Alerts</h3>
              {detail.alerts.length === 0 ? (
                <p className="text-xs text-[#837562]">No alerts for this case.</p>
              ) : (
                detail.alerts.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#352e24]">
                        {REASON_TITLES[a.reason] ?? a.reason} · <span className="uppercase">{a.level}</span>
                      </span>
                      <span className="text-[11px] text-[#837562]">{when(a.at)} · {a.status}</span>
                    </div>
                    <p className="text-xs text-[#5c5142]">{a.message}</p>
                    {a.status === 'resolved' ? (
                      <p className="text-[11px] text-[#837562]">
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
                          className="flex-1 px-3 py-1.5 rounded-lg border border-[#e5dac4] bg-white text-xs outline-none focus:border-[#9c6743]"
                        />
                        {a.status === 'open' && (
                          <button
                            onClick={() => updateAlert(a, 'acknowledge')}
                            className="px-3 py-1.5 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-xs font-semibold text-[#352e24]"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => updateAlert(a, 'resolve')}
                          className="px-3 py-1.5 rounded-lg bg-[#9c6743] hover:bg-[#b3654a] text-xs font-semibold text-white"
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
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">Voice recordings</h3>
              {!detail.consent.store_recordings ? (
                <p className="text-xs text-[#837562]">
                  {caseData.name} hasn't turned on keeping recordings (it's off by default), so none are stored.
                </p>
              ) : recordings === null ? (
                <p className="text-xs text-[#837562]">Loading…</p>
              ) : recordings.length === 0 ? (
                <p className="text-xs text-[#837562]">No recordings yet.</p>
              ) : (
                recordings.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-[#352e24]">
                        {r.kind === 'voice_note' ? 'Voice note' : 'Live check-in'} · {when(r.at)}
                        {r.duration_s ? ` · ${Math.round(r.duration_s)}s` : ''}
                        {r.detail?.emotion ? ` · sounded ${r.detail.emotion}` : ''}
                      </span>
                      <button onClick={() => play(r)} className="px-3 py-1 rounded-lg bg-[#9c6743] text-white text-xs font-semibold">
                        Play
                      </button>
                    </div>
                    {r.detail?.transcript && <p className="text-xs text-[#5c5142] italic">"{r.detail.transcript}"</p>}
                    {playing?.id === r.id && <audio src={playing.url} controls autoPlay className="w-full h-9" />}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'Consent' && (
            <div className={`${CARD} space-y-4`}>
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">What {caseData.name} has agreed to</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CONSENTS.map((c) => {
                  const on = !!detail.consent[c.key];
                  return (
                    <div key={c.key} className="p-3 bg-[#efe7d6] rounded-xl border border-[#e5dac4] flex items-center justify-between">
                      <span className="font-semibold text-xs text-[#352e24]">{c.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          on ? 'bg-[#e7d3b5] text-[#7a5a3f]' : 'bg-white text-[#837562]'
                        }`}
                      >
                        {on ? 'On' : 'Off'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#837562] leading-relaxed">
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
