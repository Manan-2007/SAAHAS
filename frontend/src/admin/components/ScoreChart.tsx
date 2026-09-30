import React, { useMemo, useRef, useState } from 'react';
import { LatestScore, ScoreComponent, Tier, Timeline, VictimDetail } from '../../lib/api';
import { CHART } from '../palette';

// The 30-day Distress Score, drawn so it can be read without a key: coloured
// zones name what each band means, the axes carry real dates and values, the
// sentence above says what changed, and every point can be read by hover,
// by arrow keys, or as a table.

const v = (name: string) => `var(--color-${name})`;
const tint = (name: string, pct: number) => `color-mix(in srgb, var(--color-${name}) ${pct}%, transparent)`;

export const TIER_WORD: Record<Tier, string> = { stable: 'Stable', watch: 'Watch', elevated: 'Elevated', high: 'High' };
const BANDS: { tier: Tier; from: number; to: number; color: string }[] = [
  { tier: 'stable', from: 0, to: 25, color: 'ok' },
  { tier: 'watch', from: 25, to: 50, color: 'sun' },
  { tier: 'elevated', from: 50, to: 75, color: 'warn' },
  { tier: 'high', from: 75, to: 100, color: 'danger' },
];
export const tierOf = (score: number): Tier => (score >= 75 ? 'high' : score >= 50 ? 'elevated' : score >= 25 ? 'watch' : 'stable');
export const tierColor = (tier: Tier) => v(BANDS.find((b) => b.tier === tier)!.color);

// Mirrors backend/monitoring/scoring.py WEIGHTS.
export const WEIGHTS: Record<ScoreComponent, number> = {
  questionnaires: 0.4, text: 0.22, voice: 0.13, engagement: 0.13, case_pressure: 0.12,
};
const DRIVER_WORDS: Record<ScoreComponent, string> = {
  questionnaires: 'questionnaire answers',
  text: 'what they wrote in chat',
  voice: 'how they sounded in voice check-ins',
  engagement: 'going quiet (no recent contact)',
  case_pressure: 'upcoming court dates or relief',
};

/** The component adding the most points right now (value x weight). */
export function mainDriver(latest: LatestScore | null): ScoreComponent | null {
  if (!latest) return null;
  let best: ScoreComponent | null = null;
  let bestPts = 0;
  for (const [key, value] of Object.entries(latest.components) as [ScoreComponent, number | undefined][]) {
    const pts = (value ?? 0) * WEIGHTS[key];
    if (value != null && pts > bestPts) {
      best = key;
      bestPts = pts;
    }
  }
  return best;
}

const DAY = 86_400_000;
const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dayTime = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "Now 80 (High). Up 22 points since 23 Sep. Mostly from how they sounded in voice check-ins." */
export function scoreSentence(timeline: Timeline, latest: LatestScore | null): string | null {
  if (!latest) return null;
  const parts = [`Now ${Math.round(latest.score)} out of 100 (${TIER_WORD[latest.tier]}).`];
  const pts = timeline.scores;
  const driver = mainDriver(latest);
  if (pts.length >= 2) {
    const weekAgo = Date.now() - 7 * DAY;
    const base = [...pts].reverse().find((p) => new Date(p.at).getTime() <= weekAgo) ?? pts[0];
    const delta = Math.round(latest.score - base.score);
    const since = day(new Date(base.at).getTime());
    parts.push(Math.abs(delta) < 3 ? `About the same as on ${since}.` : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} points since ${since}.`);
    // A falling score from silence isn't recovery: older hard signals just aged out.
    if (delta <= -3 && driver === 'engagement') {
      parts.push("They've gone quiet, so a lower score here doesn't mean they're doing better.");
      return parts.join(' ');
    }
  }
  if (driver) parts.push(`Mostly from ${DRIVER_WORDS[driver]}.`);
  return parts.join(' ');
}

const W = 640;
const H = 220;
const PAD = { l: 34, r: 74, t: 10, b: 26 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

export const ScoreChart: React.FC<{ timeline: Timeline; forecast?: VictimDetail['forecast']; latest: LatestScore | null }> = ({
  timeline,
  forecast,
  latest,
}) => {
  const [showSignals, setShowSignals] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const points = timeline.scores;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const now = Date.now();
    const t0 = Math.min(new Date(points[0].at).getTime(), now - 30 * DAY);
    const fcT = forecast?.peak_on ? new Date(`${forecast.peak_on}T12:00:00`).getTime() : null;
    const t1 = Math.max(now, fcT ?? 0);
    const X = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * IW;
    const Y = (s: number) => PAD.t + IH - (Math.max(0, Math.min(100, s)) / 100) * IH;
    const ticks = [0, 1, 2, 3].map((i) => t0 + ((now - t0) * i) / 3);
    return { now, t0, t1, fcT, X, Y, ticks };
  }, [points, forecast]);

  if (!geo) return <p className="text-sm text-ink-2">No scores yet. The line starts after their first check-in or message.</p>;
  const { now, fcT, X, Y, ticks } = geo;
  const xy = points.map((p) => ({ ...p, t: new Date(p.at).getTime(), x: X(new Date(p.at).getTime()), y: Y(p.score) }));
  const last = xy[xy.length - 1];
  const sel = active != null ? xy[active] : null;

  const pick = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((clientX - box.left) / box.width) * W;
    let best = 0;
    xy.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(xy[best].x - x)) best = i; });
    setActive(best);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const cur = active ?? xy.length - 1;
      setActive(Math.max(0, Math.min(xy.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Escape') setActive(null);
  };

  const signalLines = showSignals
    ? (['text_distress', 'voice_distress'] as const).map((m) => {
        const s = timeline.signals?.[m]?.filter((o) => o.mean != null);
        if (!s || s.length < 2) return null;
        return {
          key: m,
          color: m === 'text_distress' ? CHART.text : CHART.voice,
          pts: s.map((o) => `${X(new Date(`${o.date}T12:00:00`).getTime())},${Y(o.mean)}`).join(' '),
        };
      })
    : [];
  const summary = scoreSentence(timeline, latest);

  return (
    <div className="space-y-3">
      {summary && <p className="text-[15px] leading-snug text-ink font-medium">{summary}</p>}

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sun rounded-lg"
          role="img"
          aria-label={`Distress Score over the last 30 days. ${summary ?? ''} Use the left and right arrow keys to read each point.`}
          tabIndex={0}
          onKeyDown={onKey}
          onMouseMove={(e) => pick(e.clientX)}
          onMouseLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          {BANDS.map((b) => (
            <g key={b.tier}>
              <rect x={PAD.l} width={IW} y={Y(b.to)} height={Y(b.from) - Y(b.to)} style={{ fill: tint(b.color, 9) }} />
              <text x={PAD.l + IW + 8} y={(Y(b.to) + Y(b.from)) / 2 + 4} style={{ fill: v(b.color) }} fontSize="12" fontWeight="600">
                {TIER_WORD[b.tier]}
              </text>
            </g>
          ))}
          {[0, 25, 50, 75, 100].map((s) => (
            <g key={s}>
              <line x1={PAD.l} x2={PAD.l + IW} y1={Y(s)} y2={Y(s)} style={{ stroke: CHART.grid }} strokeWidth="1" />
              <text x={PAD.l - 6} y={Y(s) + 4} textAnchor="end" fontSize="11" style={{ fill: v('ink-2') }}>{s}</text>
            </g>
          ))}
          {ticks.map((t, i) => (
            <text key={t} x={X(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} fontSize="11" style={{ fill: v('ink-2') }}>
              {i === ticks.length - 1 ? 'Today' : day(t)}
            </text>
          ))}
          <line x1={X(now)} x2={X(now)} y1={PAD.t} y2={PAD.t + IH} style={{ stroke: v('ink-3') }} strokeDasharray="2 3" />

          {signalLines.map((s) => s && (
            <polyline key={s.key} points={s.pts} fill="none" style={{ stroke: s.color }} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
          ))}

          {(timeline.questionnaires ?? []).map((q, i) => {
            const x = X(new Date(q.at).getTime());
            return <path key={`q${i}`} d={`M${x} ${PAD.t + IH - 9} l5 5 l-5 5 l-5 -5 z`} style={{ fill: CHART.tick }} />;
          })}

          {xy.length > 1 && (
            <polyline points={xy.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" style={{ stroke: CHART.score }} strokeWidth="2.5" strokeLinejoin="round" />
          )}
          {xy.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.crisis ? 5.5 : xy.length > 40 ? 0 : 2.5}
                    style={{ fill: p.crisis ? CHART.crisis : CHART.score, stroke: p.crisis ? v('canvas') : 'none' }} strokeWidth="1.5" />
          ))}

          {forecast && fcT && (
            <g>
              <line x1={last.x} y1={last.y} x2={X(fcT)} y2={Y(forecast.peak_score)} style={{ stroke: CHART.forecast }} strokeWidth="2" strokeDasharray="6 4" />
              <circle cx={X(fcT)} cy={Y(forecast.peak_score)} r="5" fill="none" style={{ stroke: CHART.forecast }} strokeWidth="2" />
            </g>
          )}

          {sel && (
            <g pointerEvents="none">
              <line x1={sel.x} x2={sel.x} y1={PAD.t} y2={PAD.t + IH} style={{ stroke: v('ink') }} strokeWidth="1" opacity="0.5" />
              <circle cx={sel.x} cy={sel.y} r="6" style={{ fill: 'none', stroke: v('ink') }} strokeWidth="2" />
            </g>
          )}
        </svg>

        {sel && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-2 pointer-events-none px-3 py-2 rounded-lg bg-ink text-canvas text-xs shadow-lg"
            style={sel.x / W > 0.6 ? { right: `${100 - (sel.x / W) * 100 + 2}%` } : { left: `${(sel.x / W) * 100 + 2}%` }}
          >
            <div className="font-semibold">{dayTime(sel.t)}</div>
            <div>
              Score <strong>{Math.round(sel.score)}</strong> · {TIER_WORD[sel.tier]}
              {sel.crisis && <span className="ml-1 font-bold">· crisis signal</span>}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-xs text-ink-2">
        <Key swatch={<span className="w-4 h-[3px] rounded-full" style={{ background: CHART.score }} />}>Distress Score</Key>
        <Key swatch={<span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART.crisis }} />}>Crisis signal</Key>
        {(timeline.questionnaires?.length ?? 0) > 0 && (
          <Key swatch={<span className="w-2 h-2 rotate-45" style={{ background: CHART.tick }} />}>Questionnaire done</Key>
        )}
        {forecast && <Key swatch={<span className="w-4 border-t-2 border-dashed" style={{ borderColor: CHART.forecast }} />}>Forecast</Key>}
        {showSignals && (
          <>
            <Key swatch={<span className="w-4 border-t-2 border-dashed" style={{ borderColor: CHART.text }} />}>Chat, daily average</Key>
            <Key swatch={<span className="w-4 border-t-2 border-dashed" style={{ borderColor: CHART.voice }} />}>Voice, daily average</Key>
          </>
        )}
        <span className="flex-1" />
        <label className="inline-flex items-center gap-1.5 cursor-pointer text-ink">
          <input type="checkbox" checked={showSignals} onChange={(e) => setShowSignals(e.target.checked)} className="accent-current" />
          Show chat and voice lines
        </label>
        <button type="button" onClick={() => setShowTable((s) => !s)} className="text-ink underline underline-offset-4">
          {showTable ? 'Hide table' : 'Show as table'}
        </button>
      </div>

      {showTable && (
        <div className="max-h-64 overflow-y-auto border border-line rounded-lg">
          <table className="w-full text-xs">
            <caption className="sr-only">Distress Score readings, newest first</caption>
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-ink-2">
                <th scope="col" className="px-3 py-2 font-semibold">When</th>
                <th scope="col" className="px-3 py-2 font-semibold">Score</th>
                <th scope="col" className="px-3 py-2 font-semibold">Zone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...xy].reverse().map((p, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-ink-2">{dayTime(p.t)}</td>
                  <td className="px-3 py-1.5 font-semibold text-ink">{Math.round(p.score)}</td>
                  <td className="px-3 py-1.5" style={{ color: tierColor(p.tier) }}>
                    {TIER_WORD[p.tier]}{p.crisis ? ' · crisis signal' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Key: React.FC<{ swatch: React.ReactNode; children: React.ReactNode }> = ({ swatch, children }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="inline-flex w-4 justify-center" aria-hidden>{swatch}</span>
    {children}
  </span>
);
