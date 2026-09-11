import React, { useState } from 'react';
import { CaseData } from '../types';

interface PriorityCasesViewProps {
  cases: CaseData[];
  onSelectCase: (caseId: string) => void;
  onNavigateToDetail: (caseId: string) => void;
}

export const PriorityCasesView: React.FC<PriorityCasesViewProps> = ({
  cases,
  onSelectCase,
  onNavigateToDetail,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'DETERIORATION' | 'ACOUSTIC' | 'COURT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.assignedCounsellor.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'HIGH') return c.escalationRisk === 'HIGH';
    if (filter === 'DETERIORATION') return c.status.includes('Deterioration');
    if (filter === 'ACOUSTIC') return c.status.includes('Acoustic') || c.keyHighlight.includes('Acoustic') || c.keyHighlight.includes('Tremor');
    if (filter === 'COURT') return c.escalationReason.toLowerCase().includes('court') || c.keyHighlight.toLowerCase().includes('hearing');

    return true;
  });

  return (
    <div className="flex flex-col space-y-6">
      {/* Header & Filter bar */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ba1a1a] text-[24px]">emergency</span>
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl text-[#352e24] font-bold">
                Priority Triage Queue
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] font-['Inter'] text-xs font-bold">
                4 High Alert
              </span>
            </div>
            <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
              Real-time ranked by passive multimodal divergence Z-score under Protocol v3.2.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#837562] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, ID, or counsellor..."
                className="pl-9 pr-3 py-1.5 rounded-lg border border-[#e5dac4] bg-[#f5f1e8] text-xs text-[#352e24] w-64 focus:outline-none focus:border-[#9c6743]"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#efe7d6]">
          {[
            { id: 'ALL', label: 'All Cases' },
            { id: 'HIGH', label: 'High Attention' },
            { id: 'DETERIORATION', label: 'Silent Deterioration' },
            { id: 'ACOUSTIC', label: 'Acoustic Tension' },
            { id: 'COURT', label: 'Upcoming Court Dates' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-['Inter'] transition-colors ${
                filter === tab.id
                  ? 'bg-[#9c6743] text-white font-semibold shadow-xs'
                  : 'bg-[#f5f1e8] text-[#837562] hover:bg-[#efe7d6]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Triage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCases.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between hover:shadow-md transition-all"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-['Plus_Jakarta_Sans'] text-base font-bold shadow-xs ${
                      c.statusType === 'error'
                        ? 'bg-[#ffdad6] text-[#ba1a1a]'
                        : c.statusType === 'success'
                        ? 'bg-[#e7d3b5] text-[#7a5a3f]'
                        : 'bg-[#e5dac4] text-[#352e24]'
                    }`}
                  >
                    {c.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
                        {c.name}
                      </h3>
                      <span className="font-mono text-xs bg-[#efe7d6] px-2 py-0.5 rounded text-[#837562]">
                        {c.number}
                      </span>
                    </div>
                    <span className="text-xs text-[#837562]">
                      Assigned: {c.assignedCounsellor} • {c.timeAgo}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-['Inter'] font-bold ${
                    c.escalationRisk === 'HIGH'
                      ? 'bg-[#ffdad6] text-[#ba1a1a]'
                      : 'bg-[#e7d3b5] text-[#7a5a3f]'
                  }`}
                >
                  {c.escalationRisk}
                </span>
              </div>

              <div className="mt-4 p-3 bg-[#efe7d6] rounded-xl">
                <span className="font-['Inter'] text-xs font-semibold text-[#ba1a1a] block">
                  {c.status}
                </span>
                <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#5c5142] mt-1">
                  {c.alertDescription}
                </p>
              </div>

              {/* Mini Vitals */}
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="p-2 bg-[#f5f1e8] rounded-lg border border-[#e5dac4]">
                  <span className="text-[10px] text-[#837562] block font-['Inter']">Well-being</span>
                  <span className="font-bold text-sm text-[#352e24]">{c.wellbeingIndex}</span>
                </div>
                <div className="p-2 bg-[#f5f1e8] rounded-lg border border-[#e5dac4]">
                  <span className="text-[10px] text-[#837562] block font-['Inter']">Fatigue Marker</span>
                  <span className="font-bold text-sm text-[#352e24]">{c.fatigueMarker}</span>
                </div>
                <div className="p-2 bg-[#f5f1e8] rounded-lg border border-[#e5dac4]">
                  <span className="text-[10px] text-[#837562] block font-['Inter']">Confidence</span>
                  <span className="font-bold text-sm text-[#8a6a4a]">{c.aiConfidencePct}%</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#efe7d6] flex items-center justify-between">
              <span className="text-xs text-[#837562] flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[16px] text-[#9c6743]">
                  {c.keyHighlightIcon}
                </span>
                {c.keyHighlight}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectCase(c.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-[#352e24] text-xs font-semibold font-['Inter'] transition-colors"
                >
                  Quick Triage
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToDetail(c.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#9c6743] hover:bg-[#b3654a] text-white text-xs font-semibold font-['Inter'] transition-colors"
                >
                  Case Signals
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
