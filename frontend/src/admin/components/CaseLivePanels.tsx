import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, Insight, Reading, api } from '../../lib/api';
import { CHANNEL_LABEL, LEVEL_STYLE, timeShort, useLiveEvents } from '../liveBus';

const CARD = 'bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]';
const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend.");
const PEAK: Record<string, string> = { calm: 'none', low: 'low', moderate: 'moderate', high: 'high' };

export const InsightCard: React.FC<{ insight: Insight }> = ({ insight: i }) => {
  const peak = LEVEL_STYLE[PEAK[i.peak_level ?? 'calm'] ?? 'none'];
  return (
    <div className="rounded-xl border border-[#ece2ce] p-4 flex flex-col gap-2.5 bg-[#fffdf8]">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-[#837562]">
          {(CHANNEL_LABEL[i.channel]?.label ?? 'Conversation')} · {timeShort(i.period_start)} · {i.turns} message{i.turns === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1.5">
          {i.peak_level && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: peak.color, backgroundColor: peak.bg }}>
              Peak: {peak.label}
            </span>
          )}
          <span className="text-[10px] text-[#837562]" title={i.generator === 'model' ? 'Written by the SAHAAS model' : 'Model unavailable: built from readings and detection'}>
            {i.generator === 'model' ? 'AI summary' : 'Rule-based'}
          </span>
        </div>
      </div>
      {i.emotions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {i.emotions.map((e) => (
            <span key={e} className="px-2 py-0.5 rounded-full bg-[#efe7d6] text-[#7a5a3f] text-[11px] font-semibold capitalize">{e}</span>
          ))}
        </div>
      )}
      <p className="text-sm text-[#352e24] leading-relaxed">{i.summary}</p>
      {i.concerns.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#837562]">Worries</p>
          <ul className="text-xs text-[#5c5142] list-disc pl-4">{i.concerns.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {i.case_problems.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#837562]">Case problems (added to Case Issues)</p>
          <ul className="text-xs text-[#7a4a30] flex flex-col gap-0.5">
            {i.case_problems.map((p, k) => <li key={k}>⚖ {p.description || p.category.replace(/_/g, ' ')}</li>)}
          </ul>
        </div>
      )}
      {i.risk_notes && (
        <p className="text-xs font-semibold text-[#93000a] bg-[#ffdad6]/50 rounded-lg px-2.5 py-1.5">{i.risk_notes}</p>
      )}
      {i.follow_up && (
        <p className="text-xs text-[#352e24] bg-[#efe7d6]/60 rounded-lg px-2.5 py-1.5"><strong>Suggested next step:</strong> {i.follow_up}</p>
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
          <h3 className="text-base font-bold text-[#352e24]">How conversations went</h3>
          <p className="text-xs text-[#837562] max-w-xl">
            After each chat, voice call or check-in, SAHAAS writes a short note for you: emotions, worries, case problems and
            a suggested next step. It never passes on {name}’s exact words.
          </p>
        </div>
        <button onClick={summariseNow} disabled={asking}
                className="px-3 py-1.5 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-xs font-semibold disabled:opacity-50">
          {asking ? 'Summarising…' : 'Summarise the current conversation now'}
        </button>
      </div>
      {!shares && <p className="text-xs text-[#837562] bg-[#f5f1e8] rounded-lg p-2.5">{name} has turned off sharing conversation summaries, so none are written.</p>}
      {error && <p className="text-xs text-[#93000a]">{error}</p>}
      {items === null ? <p className="text-xs text-[#837562]">Loading…</p> : items.length === 0 ? (
        <p className="text-xs text-[#837562]">No summaries yet. One appears a minute or two after a conversation goes quiet.</p>
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
  return (
    <div className={`${CARD} space-y-4`}>
      <div>
        <h3 className="text-base font-bold text-[#352e24]">Every message, as the distress model read it</h3>
        <p className="text-xs text-[#837562]">Updated live. 0-100, higher is harder. No words are shown.</p>
      </div>
      {recent.length > 1 && (
        <svg viewBox={`0 0 ${recent.length * 10} 60`} className="w-full h-16" preserveAspectRatio="none" role="img" aria-label="Distress per message">
          {[25, 50, 75].map((y) => <line key={y} x1="0" x2={recent.length * 10} y1={60 - y * 0.6} y2={60 - y * 0.6} stroke="#ece2ce" strokeWidth="0.5" />)}
          {recent.map((r, i) => (
            <rect key={r.id} x={i * 10 + 2} width="6" y={60 - Math.max(2, r.score * 0.6)} height={Math.max(2, r.score * 0.6)} rx="1.5"
                  fill={r.crisis || r.level === 3 ? '#ba1a1a' : r.level === 2 ? '#d98b2b' : r.level === 1 ? '#c8a97e' : '#d9cdb8'} />
          ))}
        </svg>
      )}
      <div className="divide-y divide-[#efe7d6]">
        {items === null ? <p className="text-xs text-[#837562]">Loading…</p> : items.length === 0 ? (
          <p className="text-xs text-[#837562]">No messages yet.</p>
        ) : items.slice(0, 50).map((r) => {
          const lvl = LEVEL_STYLE[r.label];
          return (
            <div key={r.id} className="py-2 flex items-center gap-3 text-xs">
              <span className="material-symbols-outlined text-[18px] text-[#9c6743]">{CHANNEL_LABEL[r.channel]?.icon ?? 'forum'}</span>
              <span className="flex-1 text-[#5c5142]">{CHANNEL_LABEL[r.channel]?.label ?? r.channel} · {timeShort(r.at)}
                {r.issues.length > 0 && <span className="text-[#7a4a30]"> · ⚖ {r.issues.map((i) => i.replace(/_/g, ' ')).join(', ')}</span>}
              </span>
              {r.crisis && <span className="font-bold text-white bg-[#ba1a1a] px-1.5 py-0.5 rounded text-[10px]">CRISIS</span>}
              <span className="font-bold px-2 py-0.5 rounded-full" style={{ color: lvl.color, backgroundColor: lvl.bg }}>{lvl.label} · {Math.round(r.score)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
