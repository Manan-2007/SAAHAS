import React, { useEffect, useState } from 'react';
import { ApiError, ForecastRow, api } from '../../lib/api';

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
  if (peak >= 75) return { bar: '#ba1a1a', chip: '#ffdad6', text: '#93000a' };
  if (peak >= 50) return { bar: '#9a5b13', chip: '#f3dcc3', text: '#5c4630' };
  return { bar: '#9c6743', chip: '#efe7d6', text: '#7a5a3f' };
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
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e5dac4] shadow-xs flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-[#efe7d6] flex items-center justify-center text-[#9c6743] shrink-0">
          <span className="material-symbols-outlined text-[24px]">calendar_month</span>
        </div>
        <div className="min-w-0">
          <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#352e24]">Who needs attention this week</h2>
          <p className="font-['Inter'] text-xs text-[#5c5142] mt-1 leading-relaxed max-w-2xl">
            The justice calendar is the stressor. When a hearing is close, SAHAAS forecasts a distress
            <strong> peak before it happens</strong> — so you can reach out first, instead of reacting after.
            Sorted by predicted peak, not current level.
          </p>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div className="bg-white rounded-2xl p-6 border border-[#e5dac4] text-center text-sm text-[#5c5142]">
          {error}
        </div>
      ) : rows === null ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[#9c6743]">
          <div className="w-7 h-7 rounded-full border-2 border-[#e7d3b5] border-t-[#9c6743] animate-spin"></div>
          <span className="text-xs font-semibold">Reading the calendar…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-[#e5dac4] text-center flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-[#8a7d68] text-[32px]">event_available</span>
          <p className="text-sm font-semibold text-[#352e24]">A calm week ahead</p>
          <p className="text-xs text-[#5c5142] max-w-sm leading-relaxed">
            No hearings within the next 14 days across your caseload, so nothing is forecast to spike.
            Priority Cases still shows anyone in distress right now.
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
                className="relative bg-white rounded-2xl border border-[#e5dac4] shadow-xs overflow-hidden flex items-stretch"
              >
                <span className="w-1.5 shrink-0" style={{ backgroundColor: style.bar }} />
                <div className="flex-1 min-w-0 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                  {/* Who + why */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#352e24]">{r.name}</span>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: style.chip, color: style.text }}
                      >
                        <span className="material-symbols-outlined text-[13px]">gavel</span>
                        {r.driver}
                      </span>
                    </div>
                    <p className="font-['Inter'] text-[11px] text-[#837562] mt-1">
                      Predicted to peak {peakDate(r.peak_on)}
                      {until >= 0 && ` · ${until === 0 ? 'today' : until === 1 ? 'tomorrow' : `in ${until} days`}`}
                    </p>
                  </div>

                  {/* Now -> forecast */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex flex-col items-center">
                      <span className="font-['Inter'] text-[10px] text-[#837562] uppercase tracking-wide">Now</span>
                      <span className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#5c5142] tabular-nums">
                        {r.score == null ? '—' : Math.round(r.score)}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[#8a7d68] text-[20px]">trending_flat</span>
                    <div className="flex flex-col items-center">
                      <span className="font-['Inter'] text-[10px] uppercase tracking-wide" style={{ color: style.text }}>
                        Peak
                      </span>
                      <span
                        className="font-['Plus_Jakarta_Sans'] text-lg font-bold tabular-nums"
                        style={{ color: style.bar }}
                      >
                        {Math.round(r.peak_score)}
                      </span>
                    </div>
                    {rise != null && rise > 0 && (
                      <span
                        className="font-['Inter'] text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: style.chip, color: style.text }}
                      >
                        ↑ {rise}
                      </span>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => onOpenCase(r.victim_id)}
                    className="shrink-0 px-3.5 py-2 rounded-lg bg-[#9c6743] text-white font-['Inter'] text-xs font-semibold hover:bg-[#835636] transition-colors flex items-center gap-1.5"
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
