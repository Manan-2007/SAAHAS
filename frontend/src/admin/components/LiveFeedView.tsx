import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, Reading, api } from '../../lib/api';
import { CHANNEL_LABEL, LEVEL_STYLE, timeShort, useLiveEvents } from '../liveBus';
import { INK, TONE } from '../palette';
import { PageHeader } from './PageHeader';

interface LiveFeedViewProps {
  onOpenCase: (victimId: string) => void;
  connected: boolean;
}

type Filter = 'all' | 'moderate' | 'high';

// Every message across the caseload, as the distress model read it - the
// moment it is sent. Never the words: those stay private unless the person
// chose to share them.
export const LiveFeedView: React.FC<LiveFeedViewProps> = ({ onOpenCase, connected }) => {
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.feed(200).then((r) => { setReadings(r); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Can't reach the SAHAAS backend."));
  }, []);
  useEffect(load, [load]);

  useLiveEvents((e) => {
    if (typeof e.id !== 'number') return;
    const r = e as unknown as Reading;
    setReadings((prev) => {
      if (!prev || prev.some((x) => x.id === r.id)) return prev;
      return [{ ...r, victim_name: undefined }, ...prev].slice(0, 300);
    });
    setFresh((f) => new Set(f).add(r.id));
    window.setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(r.id); return n; }), 4000);
    // the name isn't in the event: fill it in from the server
    load();
  }, ['reading']);

  const hourAgo = Date.now() - 3600_000;
  const stats = useMemo(() => {
    const list = readings ?? [];
    const lastHour = list.filter((r) => new Date(r.at).getTime() >= hourAgo);
    return {
      hour: lastHour.length,
      moderate: lastHour.filter((r) => r.level >= 2).length,
      high: list.filter((r) => (r.level >= 3 || r.crisis) && new Date(r.at).getTime() >= Date.now() - 86400_000).length,
      issues: lastHour.filter((r) => r.issues.length).length,
    };
  }, [readings, hourAgo]);

  const shown = (readings ?? []).filter((r) => filter === 'all' ? true : filter === 'moderate' ? r.level >= 2 : r.level >= 3 || r.crisis);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Live feed"
        description="Each message, spoken turn and voice check-in, scored by the distress model the moment it arrives. You see how it read - never what was said."
        actions={
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-ok' : 'bg-ink-3'}`} aria-hidden />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Messages, last hour', value: stats.hour, tone: INK.strong },
          { label: 'Moderate or high, last hour', value: stats.moderate, tone: TONE.warn.color },
          { label: 'High or crisis, last 24 h', value: stats.high, tone: TONE.danger.color },
          { label: 'Case problems mentioned, last hour', value: stats.issues, tone: TONE.low.color },
        ].map((s) => (
          <div key={s.label} className="bg-surface rounded-tile p-4 border border-line">
            <p className="text-2xl font-bold" style={{ color: s.tone }}>{s.value}</p>
            <p className="text-xs text-ink-2 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {([['all', 'All'], ['moderate', 'Moderate +'], ['high', 'High & crisis']] as [Filter, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === id ? 'bg-ink text-canvas' : 'bg-surface border border-line text-ink-2'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-danger bg-danger/15 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-surface rounded-tile border border-line divide-y divide-line">
        {readings === null ? (
          <p className="p-5 text-xs text-ink-2">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="p-5 text-xs text-ink-2">Nothing yet. Readings appear here the moment a client writes or speaks.</p>
        ) : (
          shown.map((r) => {
            const lvl = LEVEL_STYLE[r.label] ?? LEVEL_STYLE.none;
            const ch = CHANNEL_LABEL[r.channel] ?? { label: r.channel, icon: 'forum' };
            return (
              <button key={r.id} onClick={() => onOpenCase(r.victim_id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors ${fresh.has(r.id) ? 'animate-fadeIn bg-warn/10' : ''}`}>
                <span className="material-symbols-outlined text-[20px] text-sun">{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{r.victim_name ?? 'Client'}</p>
                  <p className="text-[11px] text-ink-2">{ch.label} · {timeShort(r.at)}</p>
                </div>
                {r.issues.length > 0 && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-ink bg-sun/12 px-2 py-0.5 rounded-full">
                    <span className="material-symbols-outlined text-[14px]">gavel</span>
                    {r.issues.map((i) => i.replace(/_/g, ' ')).join(', ')}
                  </span>
                )}
                {r.crisis && <span className="text-[11px] font-bold text-canvas bg-danger px-2 py-0.5 rounded-full">CRISIS</span>}
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0" style={{ color: lvl.color, backgroundColor: lvl.bg }}>
                  {lvl.label} · {Math.round(r.score)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
