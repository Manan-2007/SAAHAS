import React from 'react';
import { CaseData } from '../types';

interface RecoveryOutcomesViewProps {
  cases: CaseData[];
  onOpenAuditTrail: () => void;
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

// Caseload outcomes over the last 30 days, computed from the real cases
function outcomes(cases: CaseData[]) {
  const changes = cases
    .filter((c) => typeof c.distressBefore === 'number' && typeof c.distressAfter === 'number')
    .map((c) => (c.distressAfter as number) - (c.distressBefore as number));
  const average = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
  const inTouch = cases.filter((c) => typeof c.metrics.missedCheckins === 'number' && c.metrics.missedCheckins <= 7).length;
  const calm = cases.filter((c) => c.alertTitle === 'No open alerts').length;
  return {
    averageChange: average == null ? '—' : `${average > 0 ? '+' : ''}${average.toFixed(1)} pts`,
    measured: changes.length,
    inTouch: pct(inTouch, cases.length),
    calm: pct(calm, cases.length),
  };
}

export const RecoveryOutcomesView: React.FC<RecoveryOutcomesViewProps> = ({
  cases,
  onOpenAuditTrail,
}) => {
  const stats = outcomes(cases);
  return (
    <div className="flex flex-col space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#8a6a4a] text-[24px]">
              trending_up
            </span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-xl text-[#352e24] font-bold">
              Closed-Loop Recovery & Outcomes
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#e7d3b5] text-[#7a5a3f] font-['Inter'] text-xs font-bold">
              Last 30 days
            </span>
          </div>
          <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
            How your caseload is moving, from the Distress Score history and check-in activity.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAuditTrail}
          className="px-3.5 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span>Case History</span>
        </button>
      </div>

      {/* Caseload Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
          <span className="text-xs text-[#837562] font-['Inter'] block font-semibold">
            Average Distress Score Change
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#8a6a4a]">
              {stats.averageChange}
            </span>
            <span className="text-xs text-[#8a6a4a] font-semibold bg-[#e7d3b5]/40 px-2 py-0.5 rounded-full">
              over 30 days
            </span>
          </div>
          <p className="text-xs text-[#5c5142] mt-2">
            Negative is better. Based on the {stats.measured} case{stats.measured === 1 ? '' : 's'} with a score 30 days ago and now.
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
          <span className="text-xs text-[#837562] font-['Inter'] block font-semibold">
            In Touch This Week
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#9c6743]">
              {stats.inTouch}
            </span>
            <span className="text-xs text-[#9c6743] font-semibold bg-[#efe7d6] px-2 py-0.5 rounded-full">
              last 7 days
            </span>
          </div>
          <p className="text-xs text-[#5c5142] mt-2">
            Share of your clients with a chat, voice or questionnaire check-in in the past week.
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
          <span className="text-xs text-[#837562] font-['Inter'] block font-semibold">
            No Open Alerts
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#8a6a4a]">
              {stats.calm}
            </span>
            <span className="text-xs text-[#8a6a4a] font-semibold bg-[#e7d3b5]/40 px-2 py-0.5 rounded-full">
              right now
            </span>
          </div>
          <p className="text-xs text-[#5c5142] mt-2">
            Share of your clients with nothing waiting for follow-up.
          </p>
        </div>
      </div>

      {/* Caseload Trajectory Table */}
      <div className="bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-4">
        <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
          Client Trajectory
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#efe7d6] text-[11px] text-[#837562] uppercase font-['Inter'] tracking-wider">
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Care Phase</th>
                <th className="py-2.5 px-3">30 Days Ago</th>
                <th className="py-2.5 px-3">Now</th>
                <th className="py-2.5 px-3">Change</th>
                <th className="py-2.5 px-3">Counsellor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efe7d6] text-xs">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-[#f5f1e8]">
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#352e24]">{c.name}</div>
                    <div className="text-[11px] text-[#837562] font-mono">{c.number}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-1 rounded-full bg-[#efe7d6] text-[#9c6743] font-semibold text-[11px]">
                      Step {c.currentStep} of 5
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#ba1a1a]">
                    {c.distressBefore} / 100
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#8a6a4a]">
                    {c.distressAfter} / 100
                  </td>
                  <td className="py-3 px-3 font-bold text-[#8a6a4a]">
                    {c.distressDelta || '—'}
                  </td>
                  <td className="py-3 px-3 text-[#837562]">{c.assignedCounsellor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
