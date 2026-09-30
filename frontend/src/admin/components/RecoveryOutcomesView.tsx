import React from 'react';
import { CaseData } from '../types';
import { PageHeader, QuietButton } from './PageHeader';

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
      <PageHeader
        title="Outcomes"
        description="How your caseload has moved over the last 30 days, from the Distress Score history and check-ins."
        actions={<QuietButton icon="history" onClick={onOpenAuditTrail}>Case history</QuietButton>}
      />

      {/* Caseload Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-tile p-5 border border-line">
          <span className="text-xs text-ink-2 block font-semibold">
            Average Distress Score Change
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className=" text-3xl font-bold text-ink-2">
              {stats.averageChange}
            </span>
            <span className="text-xs text-ink-2 font-semibold bg-soft/40 px-2 py-0.5 rounded-full">
              over 30 days
            </span>
          </div>
          <p className="text-xs text-ink-2 mt-2">
            Negative is better. Based on the {stats.measured} case{stats.measured === 1 ? '' : 's'} with a score 30 days ago and now.
          </p>
        </div>

        <div className="bg-surface rounded-tile p-5 border border-line">
          <span className="text-xs text-ink-2 block font-semibold">
            In Touch This Week
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className=" text-3xl font-bold text-sun">
              {stats.inTouch}
            </span>
            <span className="text-xs text-sun font-semibold bg-raised px-2 py-0.5 rounded-full">
              last 7 days
            </span>
          </div>
          <p className="text-xs text-ink-2 mt-2">
            Share of your clients with a chat, voice or questionnaire check-in in the past week.
          </p>
        </div>

        <div className="bg-surface rounded-tile p-5 border border-line">
          <span className="text-xs text-ink-2 block font-semibold">
            No Open Alerts
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className=" text-3xl font-bold text-ink-2">
              {stats.calm}
            </span>
            <span className="text-xs text-ink-2 font-semibold bg-soft/40 px-2 py-0.5 rounded-full">
              right now
            </span>
          </div>
          <p className="text-xs text-ink-2 mt-2">
            Share of your clients with nothing waiting for follow-up.
          </p>
        </div>
      </div>

      {/* Caseload Trajectory Table */}
      <div className="bg-surface rounded-tile p-6 border border-line space-y-4">
        <h3 className=" text-base font-bold text-ink">
          Client Trajectory
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-[11px] text-ink-2 uppercase tracking-wider">
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Care Phase</th>
                <th className="py-2.5 px-3">30 Days Ago</th>
                <th className="py-2.5 px-3">Now</th>
                <th className="py-2.5 px-3">Change</th>
                <th className="py-2.5 px-3">Counsellor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-raised">
                  <td className="py-3 px-3">
                    <div className="font-bold text-ink">{c.name}</div>
                    <div className="text-[11px] text-ink-2 font-mono">{c.number}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-1 rounded-full bg-raised text-sun font-semibold text-[11px]">
                      Step {c.currentStep} of 5
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-danger">
                    {c.distressBefore} / 100
                  </td>
                  <td className="py-3 px-3 font-semibold text-ink-2">
                    {c.distressAfter} / 100
                  </td>
                  <td className="py-3 px-3 font-bold text-ink-2">
                    {c.distressDelta || '—'}
                  </td>
                  <td className="py-3 px-3 text-ink-2">{c.assignedCounsellor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
