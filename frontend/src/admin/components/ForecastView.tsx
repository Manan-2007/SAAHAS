import React, { useEffect, useState } from 'react';
import { ApiError, ForecastRow, api } from '../../lib/api';
import { TONE } from '../palette';
import { PageHeader } from './PageHeader';

interface ForecastViewProps {
  onOpenCase: (victimId: string) => void;
}

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend. Check that it's running.";

const peakDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const daysUntil = (iso: string) =>
  Math.round((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000);

// Colour by how high the forecast peak is (counsellor-only, numbers allowed here).
function peakStyle(peak: number): { bar: string; chip: string; text: string } {
  if (peak >= 75) return { bar: TONE.danger.color, chip: TONE.danger.bg, text: TONE.danger.color };
  if (peak >= 50) return { bar: TONE.warn.color, chip: TONE.warn.bg, text: TONE.warn.color };
  return { bar: TONE.low.color, chip: TONE.neutral.bg, text: TONE.quiet.color };
}

// backend.md §5a — "triage by change, not by level": a counsellor with 200
// cases cannot read 200 numbers, so surface who is forecast to peak, and why.
export const ForecastView: React.FC<ForecastViewProps> = ({ onOpenCase }) => {
  const [rows, setRows] = useState<ForecastRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .forecast()
      .then((list) => live && (setRows(list), setError(null)))
      .catch((err) => live && setError(errorText(err)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <PageHeader
        title="This week"
        description="Hearings are often what makes distress spike. When one is close, SAHAAS forecasts the peak so you can reach out first. Sorted by the predicted peak."
      />

      {/* Body */}
      {error ? (
        <div className="bg-surface rounded-card p-6 border border-line text-center text-sm text-ink-2">
          {error}
        </div>
      ) : rows === null ? (
        <div className="flex flex-col items-center gap-3 py-16 text-sun">
          <div className="w-7 h-7 rounded-full border-2 border-line border-t-sun animate-spin"></div>
          <span className="text-xs font-semibold">Reading the calendar…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-surface rounded-card p-8 border border-line text-center flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-ink-2 text-[32px]">event_available</span>
          <p className="text-sm font-semibold text-ink">A calm week ahead</p>
          <p className="text-xs text-ink-2 max-w-sm leading-relaxed">
            No hearings within the next 14 days across your caseload, so nothing is forecast to spike.
            Caseload still shows anyone in distress right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const style = peakStyle(r.peak_score);
            const rise = r.score != null ? Math.round(r.peak_score - r.score) : null;
            const until = daysUntil(r.peak_on);
            return (
              <div
                key={r.victim_id}
                className="relative bg-surface rounded-card border border-line overflow-hidden flex items-stretch"
              >
                <span className="w-1.5 shrink-0" style={{ backgroundColor: style.bar }} />
                <div className="flex-1 min-w-0 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                  {/* Who + why */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className=" text-sm font-bold text-ink">{r.name}</span>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: style.chip, color: style.text }}
                      >
                        <span className="material-symbols-outlined text-[13px]">gavel</span>
                        {r.driver}
                      </span>
                    </div>
                    <p className=" text-[11px] text-ink-2 mt-1">
                      Predicted to peak {peakDate(r.peak_on)}
                      {until >= 0 && ` · ${until === 0 ? 'today' : until === 1 ? 'tomorrow' : `in ${until} days`}`}
                    </p>
                  </div>

                  {/* Now -> forecast */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex flex-col items-center">
                      <span className=" text-[10px] text-ink-2 uppercase tracking-wide">Now</span>
                      <span className=" text-lg font-bold text-ink-2 tabular-nums">
                        {r.score == null ? '—' : Math.round(r.score)}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-ink-2 text-[20px]">trending_flat</span>
                    <div className="flex flex-col items-center">
                      <span className=" text-[10px] uppercase tracking-wide" style={{ color: style.text }}>
                        Peak
                      </span>
                      <span
                        className=" text-lg font-bold tabular-nums"
                        style={{ color: style.bar }}
                      >
                        {Math.round(r.peak_score)}
                      </span>
                    </div>
                    {rise != null && rise > 0 && (
                      <span
                        className=" text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: style.chip, color: style.text }}
                      >
                        ↑ {rise}
                      </span>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => onOpenCase(r.victim_id)}
                    className="shrink-0 px-3.5 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold hover:bg-ink/90 transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    Open case
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
