import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, Insight, Reading, api } from '../../lib/api';
import { CHANNEL_LABEL, LEVEL_STYLE, timeShort, useLiveEvents } from '../liveBus';
import { CHART } from '../palette';

const CARD = 'bg-surface rounded-tile p-5 border border-line';
const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend.");
const PEAK: Record<string, string> = { calm: 'none', low: 'low', moderate: 'moderate', high: 'high' };

export const InsightCard: React.FC<{ insight: Insight }> = ({ insight: i }) => {
  const peak = LEVEL_STYLE[PEAK[i.peak_level ?? 'calm'] ?? 'none'];
  return (
    <div className="rounded-tile border border-line p-4 flex flex-col gap-2.5 bg-surface">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-ink-2">
          {(CHANNEL_LABEL[i.channel]?.label ?? 'Conversation')} · {timeShort(i.period_start)} · {i.turns} message{i.turns === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1.5">
          {i.peak_level && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: peak.color, backgroundColor: peak.bg }}>
              Peak: {peak.label}
            </span>
          )}
          <span className="text-[10px] text-ink-2" title={i.generator === 'model' ? 'Written by the SAHAAS model' : 'Model unavailable: built from readings and detection'}>
            {i.generator === 'model' ? 'AI summary' : 'Rule-based'}
          </span>
        </div>
      </div>
      {i.emotions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {i.emotions.map((e) => (
            <span key={e} className="px-2 py-0.5 rounded-full bg-raised text-ink text-[11px] font-semibold capitalize">{e}</span>
          ))}
        </div>
      )}
      <p className="text-sm text-ink leading-relaxed">{i.summary}</p>
      {i.concerns.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-2">Worries</p>
          <ul className="text-xs text-ink-2 list-disc pl-4">{i.concerns.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {i.case_problems.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-2">Case problems (added to Case Issues)</p>
          <ul className="text-xs text-ink flex flex-col gap-0.5">
            {i.case_problems.map((p, k) => <li key={k}>⚖ {p.description || p.category.replace(/_/g, ' ')}</li>)}
          </ul>
        </div>
      )}
      {i.risk_notes && (
        <p className="text-xs font-semibold text-danger bg-danger/15 rounded-lg px-2.5 py-1.5">{i.risk_notes}</p>
      )}
      {i.follow_up && (
        <p className="text-xs text-ink bg-raised/60 rounded-lg px-2.5 py-1.5"><strong>Suggested next step:</strong> {i.follow_up}</p>
      )}
    </div>
  );
};

export const InsightsPanel: React.FC<{ victimId: string; name: string; shares: boolean }> = ({ victimId, name, shares }) => {
  const [items, setItems] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const load = useCallback(() => {
    api.victimInsights(victimId).then(setItems).catch((e) => setError(errorText(e)));
  }, [victimId]);
  useEffect(load, [load]);
  useLiveEvents((e) => { if (e.victim_id === victimId) load(); }, ['insight']);

  const summariseNow = async () => {
    setAsking(true);
    try {
      await api.summariseNow(victimId);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-ink">How conversations went</h3>
          <p className="text-xs text-ink-2 max-w-xl">
            After each chat, voice call or check-in, SAHAAS writes a short note for you: emotions, worries, case problems and
            a suggested next step. It never passes on {name}’s exact words.
          </p>
        </div>
        <button onClick={summariseNow} disabled={asking}
                className="px-3 py-1.5 rounded-lg bg-raised hover:bg-soft text-xs font-semibold disabled:opacity-50">
          {asking ? 'Summarising…' : 'Summarise the current conversation now'}
        </button>
      </div>
      {!shares && <p className="text-xs text-ink-2 bg-canvas rounded-lg p-2.5">{name} has turned off sharing conversation summaries, so none are written.</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      {items === null ? <p className="text-xs text-ink-2">Loading…</p> : items.length === 0 ? (
        <p className="text-xs text-ink-2">No summaries yet. One appears a minute or two after a conversation goes quiet.</p>
      ) : items.map((i) => <InsightCard key={i.id} insight={i} />)}
    </div>
  );
};

export const ReadingsPanel: React.FC<{ victimId: string }> = ({ victimId }) => {
  const [items, setItems] = useState<Reading[] | null>(null);
  const load = useCallback(() => { api.victimReadings(victimId, 150).then(setItems).catch(() => setItems([])); }, [victimId]);
  useEffect(load, [load]);
  useLiveEvents((e) => { if (e.victim_id === victimId) load(); }, ['reading']);

  const recent = (items ?? []).slice(0, 60).reverse();
  // At least 30 slots, newest on the right, so a few messages don't stretch into wide pills.
  const slots = Math.max(recent.length, 30);
  const offset = slots - recent.length;
  return (
    <div className={`${CARD} space-y-4`}>
      <div>
        <h3 className="text-base font-bold text-ink">Every message, as the distress model read it</h3>
        <p className="text-xs text-ink-2">Updated live. 0-100, higher is harder. No words are shown.</p>
      </div>
      {recent.length > 1 && (
        <figure className="space-y-2">
          <svg viewBox={`0 0 ${slots * 10} 64`} className="w-full h-20" preserveAspectRatio="none" role="img"
               aria-label={`Distress per message for the last ${recent.length} messages, oldest on the left. ${recent.filter((r) => r.level >= 2 || r.crisis).length} were moderate or higher.`}>
            {[25, 50, 75].map((y) => <line key={y} x1="0" x2={slots * 10} y1={64 - y * 0.6} y2={64 - y * 0.6} style={{ stroke: CHART.grid }} strokeWidth="0.5" />)}
            {recent.map((r, i) => (
              <g key={r.id}>
                <rect x={(offset + i) * 10 + 2} width="6" y={64 - Math.max(2, r.score * 0.6)} height={Math.max(2, r.score * 0.6)} rx="1.5"
                      style={{ fill: CHART.levels[r.crisis ? 3 : r.level] }}>
                  <title>{`${CHANNEL_LABEL[r.channel]?.label ?? r.channel}, ${timeShort(r.at)}: ${LEVEL_STYLE[r.label]?.label ?? r.label} (${Math.round(r.score)})${r.crisis ? ', crisis signal' : ''}`}</title>
                </rect>
                {r.crisis && <circle cx={(offset + i) * 10 + 5} cy={64 - Math.max(2, r.score * 0.6) - 3} r="1.8" style={{ fill: CHART.crisis }} />}
              </g>
            ))}
          </svg>
          <figcaption className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-ink-2">
            <span>← older</span>
            {(['Calm', 'Low', 'Moderate', 'High or crisis'] as const).map((label, i) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART.levels[i] }} aria-hidden />{label}
              </span>
            ))}
            <span className="flex-1" />
            <span>Taller bar = harder message · newest →</span>
          </figcaption>
        </figure>
      )}
      <div className="divide-y divide-line">
        {items === null ? <p className="text-xs text-ink-2">Loading…</p> : items.length === 0 ? (
          <p className="text-xs text-ink-2">No messages yet.</p>
        ) : items.slice(0, 50).map((r) => {
          const lvl = LEVEL_STYLE[r.label];
          return (
            <div key={r.id} className="py-2 flex items-center gap-3 text-xs">
              <span aria-hidden className="material-symbols-outlined text-[18px] text-sun">{CHANNEL_LABEL[r.channel]?.icon ?? 'forum'}</span>
              <span className="flex-1 text-ink-2">{CHANNEL_LABEL[r.channel]?.label ?? r.channel} · {timeShort(r.at)}
                {r.issues.length > 0 && <span className="text-ink"> · ⚖ {r.issues.map((i) => i.replace(/_/g, ' ')).join(', ')}</span>}
              </span>
              {r.crisis && <span className="font-bold text-canvas bg-danger px-1.5 py-0.5 rounded text-[10px]">CRISIS</span>}
              <span className="font-bold px-2 py-0.5 rounded-full" style={{ color: lvl.color, backgroundColor: lvl.bg }}>{lvl.label} · {Math.round(r.score)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
