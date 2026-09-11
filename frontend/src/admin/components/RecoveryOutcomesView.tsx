import React from 'react';
import { CaseData } from '../types';

interface RecoveryOutcomesViewProps {
  cases: CaseData[];
  onOpenAuditTrail: () => void;
}

export const RecoveryOutcomesView: React.FC<RecoveryOutcomesViewProps> = ({
  cases,
  onOpenAuditTrail,
}) => {
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
              Audited Trajectory
            </span>
          </div>
          <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
            Measuring clinical de-escalation without re-traumatizing survivors with invasive surveys.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAuditTrail}
          className="px-3.5 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">file_download</span>
          <span>Export Clinical Cohort Audit</span>
        </button>
      </div>

      {/* Cohort Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
          <span className="text-xs text-[#837562] font-['Inter'] block font-semibold">
            Average Distress Score Drop
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#8a6a4a]">
              -16.4 pts
            </span>
            <span className="text-xs text-[#8a6a4a] font-semibold bg-[#e7d3b5]/40 px-2 py-0.5 rounded-full">
              48h Post-Intervention
            </span>
          </div>
          <p className="text-xs text-[#5c5142] mt-2">
            Cohort baseline de-escalates from High Strain (72) to Moderate (58) within 2 care cycles.
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
          <span className="text-xs text-[#837562] font-['Inter'] block font-semibold">
            Passive Retention Rate
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#9c6743]">
              94.2%
            </span>
            <span className="text-xs text-[#9c6743] font-semibold bg-[#efe7d6] px-2 py-0.5 rounded-full">
              Opt-in Maintained
            </span>
          </div>
          <p className="text-xs text-[#5c5142] mt-2">
            Survivors continue voluntary micro-touchpoints without drop-off due to survey fatigue.
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
          <span className="text-xs text-[#837562] font-['Inter'] block font-semibold">
            Relapse Avoidance Index
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#8a6a4a]">
              88.7%
            </span>
            <span className="text-xs text-[#8a6a4a] font-semibold bg-[#e7d3b5]/40 px-2 py-0.5 rounded-full">
              Trauma Protocol Safe
            </span>
          </div>
          <p className="text-xs text-[#5c5142] mt-2">
            Zero re-traumatizing escalation triggers in audited cohort over the past 90 days.
          </p>
        </div>
      </div>

      {/* Cohort Cases Trajectory Table */}
      <div className="bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-4">
        <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
          Patient Trajectory Status Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#efe7d6] text-[11px] text-[#837562] uppercase font-['Inter'] tracking-wider">
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Protocol Phase</th>
                <th className="py-2.5 px-3">Initial Strain</th>
                <th className="py-2.5 px-3">Current Strain</th>
                <th className="py-2.5 px-3">Improvement</th>
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
                    {c.cohortImprovementPct}
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
