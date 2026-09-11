import React, { useState } from 'react';
import { CaseData } from '../types';

interface OverviewViewProps {
  cases: CaseData[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  onToggleIntervention: (caseId: string, interventionId: string) => void;
  onOpenAssignCounsellor: () => void;
  onOpenScheduleFollowUp: () => void;
  onOpenAuditTrail: () => void;
  onAcknowledgePlan: () => void;
  onSyncBaselines: () => void;
  isSyncing: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onToggleIntervention,
  onOpenAssignCounsellor,
  onOpenScheduleFollowUp,
  onOpenAuditTrail,
  onAcknowledgePlan,
  onSyncBaselines,
  isSyncing,
}) => {
  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const [acknowledged, setAcknowledged] = useState(false);

  const handleAcknowledge = () => {
    setAcknowledged(true);
    onAcknowledgePlan();
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* TOP SYNTHETIC PROTOTYPE & ETHICS BANNER */}
      <div className="w-full bg-[#efe7d6] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs border border-[#e5dac4]">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 rounded-full bg-[#e7d3b5] flex items-center justify-center text-[#7a5a3f] flex-shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-['Plus_Jakarta_Sans'] text-lg text-[#352e24] font-semibold">
                SAHAAS Command Dashboard
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ddd0b8] text-[#5c5142] font-['Inter'] text-[11px] font-semibold">
                Protocol v3.2
              </span>
            </div>
            <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#5c5142] flex items-center gap-1.5 mt-0.5">
              <span className="material-symbols-outlined text-[16px] text-[#9c6743]">
                psychology
              </span>
              <span>
                AI-generated decision support indicators • Authorised humans make all final care decisions.
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#9c6743] font-['Inter'] text-xs font-semibold shadow-xs border border-[#e5dac4]">
            <span className="w-2 h-2 rounded-full bg-[#9c6743] animate-ping"></span>
            Multimodal Live Feed
          </span>
          <button
            id="btn-sync-baselines"
            type="button"
            onClick={onSyncBaselines}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg bg-[#e5dac4] hover:bg-[#ddd0b8] text-[#352e24] font-['Inter'] text-xs font-medium transition-colors flex items-center gap-1 shadow-xs disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? 'Syncing...' : 'Sync Baselines'}</span>
          </button>
        </div>
      </div>

      {/* KPI STATS TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Cases */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="font-['Inter'] text-sm text-[#837562] font-medium">
              Active Monitored Cases
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#ece2ce] flex items-center justify-center text-[#9c6743]">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl text-[#352e24] font-bold tracking-tight">
              846
            </span>
            <span className="font-['Inter'] text-xs text-[#8a6a4a] bg-[#efe7d6] px-2 py-0.5 rounded-full font-semibold">
              +12 this week
            </span>
          </div>
          <div className="mt-3 w-full bg-[#ece2ce] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#9c6743] h-full rounded-full" style={{ width: '78%' }}></div>
          </div>
        </div>

        {/* High Attention */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="font-['Inter'] text-sm text-[#5c5142] font-medium">High Attention</span>
            <div className="w-8 h-8 rounded-lg bg-[#ffdad6] flex items-center justify-center text-[#93000a]">
              <span className="material-symbols-outlined text-[20px]">notification_important</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl text-[#ba1a1a] font-bold tracking-tight">
              42
            </span>
            <span className="font-['Inter'] text-[11px] text-[#ba1a1a] font-semibold flex items-center gap-0.5 bg-[#ffdad6]/60 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> Requires Human Review
            </span>
          </div>
          <div className="mt-3 text-[#5c5142] font-['Plus_Jakarta_Sans'] text-xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>
            <span>4 acute acoustic spikes in last 6h</span>
          </div>
        </div>

        {/* Follow-ups Due */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="font-['Inter'] text-sm text-[#837562] font-medium">Follow-ups Due Today</span>
            <div className="w-8 h-8 rounded-lg bg-[#e5dac4] flex items-center justify-center text-[#837562]">
              <span className="material-symbols-outlined text-[20px]">calendar_clock</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl text-[#352e24] font-bold tracking-tight">
              87
            </span>
            <span className="font-['Inter'] text-xs text-[#837562] font-medium bg-[#ece2ce] px-2 py-0.5 rounded-full">
              23 Priority Legal
            </span>
          </div>
          <div className="mt-3 w-full bg-[#ece2ce] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#9a8b76] h-full rounded-full" style={{ width: '45%' }}></div>
          </div>
        </div>

        {/* Improving / Stabilized */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="font-['Inter'] text-sm text-[#837562] font-medium">Improving / Stabilized</span>
            <div className="w-8 h-8 rounded-lg bg-[#e7d3b5] flex items-center justify-center text-[#7a5a3f]">
              <span className="material-symbols-outlined text-[20px]">volunteer_activism</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl text-[#8a6a4a] font-bold tracking-tight">
              314
            </span>
            <span className="font-['Inter'] text-xs text-[#9c6743] font-semibold bg-[#e7d3b5]/40 px-2 py-0.5 rounded-full">
              37.1% Overall
            </span>
          </div>
          <div className="mt-3 w-full bg-[#ece2ce] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#8a6a4a] h-full rounded-full" style={{ width: '62%' }}></div>
          </div>
        </div>
      </div>

      {/* MAIN 2-COLUMN SECTION: CASE TRIAGE QUEUE & DEEP DIVE INSPECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT: PRIORITY CASES & EARLY ALERT QUEUE (5 Cols) */}
        <div className="xl:col-span-5 flex flex-col space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#efe7d6]">
              <div>
                <h2 className="font-['Plus_Jakarta_Sans'] text-lg text-[#352e24] font-bold">
                  Priority Cases & Triage Queue
                </h2>
                <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#5c5142]">
                  Real-time passive divergence & distress cues
                </p>
              </div>
              <div className="flex items-center gap-1 bg-[#efe7d6] px-2.5 py-1 rounded-lg">
                <span className="material-symbols-outlined text-[16px] text-[#837562]">filter_list</span>
                <span className="font-['Inter'] text-xs text-[#837562] font-semibold">Auto-ranked</span>
              </div>
            </div>

            {/* Case Cards List */}
            <div className="space-y-2.5 mt-3" id="case-queue">
              {cases.map((c) => {
                const isSelected = c.id === activeCase.id;
                return (
                  <div
                    key={c.id}
                    id={`case-card-${c.id}`}
                    onClick={() => onSelectCase(c.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all relative overflow-hidden border ${
                      isSelected
                        ? 'bg-[#efe7d6] border-[#e5dac4] shadow-xs'
                        : 'bg-white border-[#efe7d6] hover:bg-[#f5f1e8]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ba1a1a]"></div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-['Inter'] text-sm font-bold shadow-xs ${
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
                            <span className="font-['Inter'] text-sm font-semibold text-[#352e24]">
                              {c.name}
                            </span>
                            <span className="font-['Inter'] text-xs text-[#837562]">{c.number}</span>
                          </div>
                          <span
                            className={`font-['Inter'] text-xs font-medium flex items-center gap-1 mt-0.5 ${
                              c.statusType === 'error'
                                ? 'text-[#ba1a1a]'
                                : c.statusType === 'success'
                                ? 'text-[#8a6a4a]'
                                : 'text-[#837562]'
                            }`}
                          >
                            {c.statusType === 'error' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-pulse"></span>
                            )}
                            {c.status}
                          </span>
                        </div>
                      </div>
                      <span className="font-['Inter'] text-xs text-[#837562]">{c.timeAgo}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[#5c5142] font-['Plus_Jakarta_Sans'] text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-[#ece2ce]">
                      <span
                        className={`flex items-center gap-1 font-medium ${
                          c.keyHighlightColor === 'error'
                            ? 'text-[#ba1a1a]'
                            : c.keyHighlightColor === 'secondary'
                            ? 'text-[#8a6a4a]'
                            : 'text-[#352e24]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{c.keyHighlightIcon}</span>
                        {c.keyHighlight}
                      </span>
                      <span className="text-[#837562] font-['Inter'] text-[11px]">{c.subHighlight}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Counselor Reassurance Memo */}
            <div className="mt-4 p-4 bg-[#e7d3b5]/25 rounded-xl flex items-start gap-2.5 border border-[#e7d3b5]/40">
              <span className="material-symbols-outlined text-[#8a6a4a] text-[20px] mt-0.5">shield</span>
              <div className="flex flex-col">
                <span className="font-['Inter'] text-xs text-[#352e24] font-semibold">
                  Trauma-Informed Safe Protocol
                </span>
                <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#5c5142] mt-0.5 leading-relaxed">
                  Divergence metrics evaluate behavioral drift without exposing raw text logs to third parties. All notes maintain client legal privilege.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CASE DETAIL INSPECTION & MULTIMODAL SIGNAL ANALYSIS (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] space-y-4">
            {/* Case Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#efe7d6]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center font-['Plus_Jakarta_Sans'] text-lg font-bold shadow-xs">
                  {activeCase.initials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#352e24]">
                      {activeCase.name}
                    </h3>
                    <span className="font-['Inter'] text-xs bg-[#ece2ce] px-2 py-0.5 rounded text-[#837562] font-mono">
                      {activeCase.number}
                    </span>
                  </div>
                  <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562]">
                    Registered: {activeCase.registeredDate} • Assigned: {activeCase.assignedCounsellor}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full font-['Inter'] text-xs font-bold flex items-center gap-1.5 ${
                    activeCase.statusType === 'error'
                      ? 'bg-[#ffdad6] text-[#ba1a1a]'
                      : 'bg-[#e7d3b5] text-[#7a5a3f]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  {activeCase.escalationRisk === 'HIGH' ? 'High Attention' : activeCase.escalationRisk}
                </span>

                <button
                  id="btn-export-case-summary"
                  type="button"
                  onClick={onOpenAuditTrail}
                  className="p-2 rounded-lg bg-[#e5dac4] hover:bg-[#ddd0b8] text-[#5c5142] transition-colors"
                  title="Export confidential case summary & audit trail"
                >
                  <span className="material-symbols-outlined text-[18px]">ios_share</span>
                </button>
              </div>
            </div>

            {/* Vital Signals Gauges */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-[#efe7d6] rounded-xl border border-[#e5dac4]">
              <div className="flex flex-col">
                <span className="font-['Inter'] text-[11px] text-[#837562] uppercase tracking-wider font-semibold">
                  Well-being Index
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl text-[#352e24] font-bold">
                    {activeCase.wellbeingIndex}
                  </span>
                  <span className="font-['Inter'] text-xs text-[#ba1a1a] font-semibold">
                    {activeCase.wellbeingDelta}
                  </span>
                </div>
                <span className="font-['Inter'] text-xs text-[#837562] mt-0.5">Elevated distress</span>
              </div>

              <div className="flex flex-col">
                <span className="font-['Inter'] text-[11px] text-[#837562] uppercase tracking-wider font-semibold">
                  Fatigue Marker
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl text-[#352e24] font-bold">
                    {activeCase.fatigueMarker}
                  </span>
                  <span className="font-['Inter'] text-xs text-[#ba1a1a] font-semibold">
                    {activeCase.fatigueDelta}
                  </span>
                </div>
                <span className="font-['Inter'] text-xs text-[#837562] mt-0.5">Sleep & pause drift</span>
              </div>

              <div className="flex flex-col">
                <span className="font-['Inter'] text-[11px] text-[#837562] uppercase tracking-wider font-semibold">
                  Escalation Risk
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`font-['Plus_Jakarta_Sans'] text-2xl font-bold ${
                      activeCase.escalationRisk === 'HIGH' ? 'text-[#ba1a1a]' : 'text-[#8a6a4a]'
                    }`}
                  >
                    {activeCase.escalationRisk}
                  </span>
                </div>
                <span className="font-['Inter'] text-xs text-[#ba1a1a] font-medium mt-0.5">
                  {activeCase.escalationReason}
                </span>
              </div>
            </div>

            {/* PROMINENT ALERT: SILENT DETERIORATION DETECTED */}
            <div className="bg-[#ffdad6]/35 rounded-xl p-4 shadow-xs border border-[#ffdad6] relative overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                </div>
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <h4 className="font-['Plus_Jakarta_Sans'] text-base text-[#ba1a1a] font-bold">
                      {activeCase.alertTitle}
                    </h4>
                    <span className="font-['Inter'] text-xs text-[#837562] font-mono">
                      {activeCase.alertConfCode}
                    </span>
                  </div>
                  <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#352e24] mt-1 leading-relaxed">
                    {activeCase.alertDescription}
                  </p>

                  {/* Deterioration Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                    <div className="bg-white p-2.5 rounded-lg shadow-xs border border-[#ffdad6]/60">
                      <span className="font-['Inter'] text-[11px] text-[#837562] block">
                        Response Length
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] text-base text-[#ba1a1a] font-bold flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[16px]">arrow_downward</span>{' '}
                        {activeCase.metrics.responseLengthDelta}
                      </span>
                      <span className="font-['Inter'] text-[10px] text-[#837562]">
                        {activeCase.metrics.responseLengthNote}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg shadow-xs border border-[#ffdad6]/60">
                      <span className="font-['Inter'] text-[11px] text-[#837562] block">
                        Response Latency
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] text-base text-[#ba1a1a] font-bold flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[16px]">arrow_upward</span>{' '}
                        {activeCase.metrics.responseLatencyDelta}
                      </span>
                      <span className="font-['Inter'] text-[10px] text-[#837562]">
                        {activeCase.metrics.responseLatencyNote}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg shadow-xs border border-[#ffdad6]/60">
                      <span className="font-['Inter'] text-[11px] text-[#837562] block">
                        Voice Duration
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] text-base text-[#ba1a1a] font-bold flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[16px]">arrow_downward</span>{' '}
                        {activeCase.metrics.voiceDurationDelta}
                      </span>
                      <span className="font-['Inter'] text-[10px] text-[#837562]">
                        {activeCase.metrics.voiceDurationNote}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg shadow-xs border border-[#ffdad6]/60">
                      <span className="font-['Inter'] text-[11px] text-[#837562] block">
                        Missed Check-ins
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] text-base text-[#ba1a1a] font-bold flex items-center gap-1 mt-0.5">
                        {activeCase.metrics.missedCheckins}
                      </span>
                      <span className="font-['Inter'] text-[10px] text-[#837562]">
                        {activeCase.metrics.missedCheckinsNote}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MULTIMODAL SIGNAL CONSISTENCY MATRIX */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="font-['Plus_Jakarta_Sans'] text-sm text-[#352e24] font-semibold">
                  Multimodal Signal Consistency Matrix
                </h4>
                <span className="font-['Inter'] text-xs text-[#837562]">
                  Opt-in Trauma-Informed Sensors
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeCase.signals.map((sig, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#efe7d6] flex items-center justify-between border border-[#e5dac4]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          sig.statusColor === 'secondary'
                            ? 'bg-[#8a6a4a]'
                            : sig.statusColor === 'amber'
                            ? 'bg-amber-500'
                            : sig.statusColor === 'error'
                            ? 'bg-[#ba1a1a]'
                            : 'bg-[#9c6743]'
                        }`}
                      ></span>
                      <div>
                        <span className="font-['Inter'] text-xs text-[#352e24] font-semibold block">
                          {sig.label}
                        </span>
                        <span className="font-['Plus_Jakarta_Sans'] text-[11px] text-[#5c5142]">
                          {sig.description}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-['Inter'] text-[11px] font-semibold whitespace-nowrap ml-2 ${
                        sig.statusColor === 'error'
                          ? 'bg-[#ffdad6] text-[#93000a]'
                          : sig.statusColor === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-[#e5dac4] text-[#8a6a4a]'
                      }`}
                    >
                      {sig.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* AI Confidence & Flag Box */}
              <div className="p-3.5 rounded-xl bg-[#ece2ce] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-[#e5dac4]">
                <div className="flex items-center gap-3">
                  <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[#ddd0b8]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      ></path>
                      <path
                        className="text-[#8a6a4a]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${activeCase.aiConfidencePct}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      ></path>
                    </svg>
                    <span className="absolute font-['Inter'] text-[11px] font-bold text-[#352e24]">
                      {activeCase.aiConfidencePct}%
                    </span>
                  </div>
                  <div>
                    <span className="font-['Inter'] text-xs text-[#352e24] font-semibold block">
                      AI Confidence: {activeCase.aiConfidenceLabel}
                    </span>
                    <p className="font-['Plus_Jakarta_Sans'] text-[11px] text-[#5c5142]">
                      {activeCase.aiConfidenceDescription}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenAuditTrail}
                  className="px-2.5 py-1 rounded-full bg-[#e5dac4] hover:bg-[#ddd0b8] text-[#5c5142] font-['Inter'] text-[11px] font-medium whitespace-nowrap self-end sm:self-auto border border-[#cabca6]"
                >
                  {activeCase.explainableRuleId}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: HUMAN-IN-THE-LOOP CARE PLAN & RECOVERY VERIFICATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* HUMAN-IN-THE-LOOP INTERVENTION & ACTION CHECKLIST (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#9c6743] text-[22px]">clinical_notes</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base text-[#352e24] font-bold">
                  Human-in-the-Loop Intervention Plan
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#e7d3b5] text-[#7a5a3f] font-['Inter'] text-xs font-bold">
                Action Ready
              </span>
            </div>
            <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#5c5142]">
              Empowering the clinical counsellor to review, adapt, and certify all interventions before deployment.
            </p>

            {/* Rationale Callout */}
            <div className="mt-3 p-3.5 rounded-xl bg-[#efe7d6] flex items-start gap-2.5 border border-[#e5dac4]">
              <span className="material-symbols-outlined text-[#8a6a4a] text-[20px] mt-0.5">psychology_alt</span>
              <div>
                <span className="font-['Inter'] text-xs text-[#352e24] font-semibold">
                  Why this was recommended
                </span>
                <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#5c5142] mt-0.5 leading-relaxed">
                  {activeCase.whyRecommended}
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div className="mt-3 space-y-2">
              {activeCase.interventions.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-[#efe7d6] cursor-pointer transition-colors border border-[#ece2ce] shadow-xs"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => onToggleIntervention(activeCase.id, item.id)}
                    className="w-5 h-5 rounded text-[#9c6743] focus:ring-[#9c6743] accent-[#9c6743] cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span
                      className={`font-['Inter'] text-sm font-medium ${
                        item.completed ? 'text-[#352e24] line-through decoration-[#837562]/60' : 'text-[#352e24]'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562]">{item.subtitle}</span>
                  </div>
                  <span
                    className={`ml-auto px-2 py-0.5 rounded font-['Inter'] text-[11px] font-medium ${
                      item.status === 'In Progress'
                        ? 'bg-[#e7d3b5] text-[#7a5a3f]'
                        : item.status === 'Completed'
                        ? 'bg-[#efe7d6] text-[#9c6743] font-bold'
                        : 'bg-[#ece2ce] text-[#837562]'
                    }`}
                  >
                    {item.status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#efe7d6] flex flex-wrap items-center gap-2.5">
            <button
              id="btn-assign-counsellor"
              type="button"
              onClick={onOpenAssignCounsellor}
              className="px-4 py-2 rounded-lg bg-[#9c6743] hover:bg-[#b3654a] text-white font-['Inter'] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Assign Counsellor</span>
            </button>

            <button
              id="btn-schedule-followup"
              type="button"
              onClick={onOpenScheduleFollowUp}
              className="px-4 py-2 rounded-lg bg-[#e7d3b5] hover:bg-[#e7d3b5] text-[#7a5a3f] font-['Inter'] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              <span>Schedule Follow-up</span>
            </button>

            <button
              id="btn-acknowledge-plan"
              type="button"
              onClick={handleAcknowledge}
              className={`px-4 py-2 rounded-lg font-['Inter'] text-xs font-semibold transition-colors flex items-center gap-1.5 ml-auto border ${
                acknowledged
                  ? 'bg-[#efe7d6] text-[#9c6743] border-[#9c6743]'
                  : 'bg-[#e5dac4] hover:bg-[#ddd0b8] text-[#352e24] border-[#cabca6]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {acknowledged ? 'task_alt' : 'check_circle'}
              </span>
              <span>{acknowledged ? 'Certified & Logged' : 'Mark Reviewed & Acknowledge'}</span>
            </button>
          </div>
        </div>

        {/* RECOVERY & OUTCOME VERIFICATION (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#8a6a4a] text-[22px]">published_with_changes</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base text-[#352e24] font-bold">
                  Closed-Loop Recovery Verification
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#efe7d6] text-[#8a6a4a] font-['Inter'] text-xs font-semibold">
                Audited
              </span>
            </div>
            <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#5c5142]">
              5-Stage Trajectory Tracker ensuring intervention efficacy without re-traumatizing check-in burdens.
            </p>

            {/* 5 Step Flow Horizontal Indicator */}
            <div className="mt-3 p-3 bg-[#efe7d6] rounded-xl border border-[#e5dac4]">
              <div className="flex items-center justify-between text-center relative">
                {[
                  { step: 1, label: 'Detect' },
                  { step: 2, label: 'Intervene' },
                  { step: 3, label: 'Follow-up' },
                  { step: 4, label: 'Measure' },
                  { step: 5, label: 'Recover' },
                ].map((s, idx) => {
                  const isDone = s.step <= activeCase.currentStep;
                  return (
                    <React.Fragment key={s.step}>
                      <div className="flex flex-col items-center z-10">
                        <span
                          className={`w-6 h-6 rounded-full font-['Inter'] text-xs font-bold flex items-center justify-center shadow-xs ${
                            isDone ? 'bg-[#9c6743] text-white' : 'bg-[#e5dac4] text-[#5c5142]'
                          }`}
                        >
                          {s.step}
                        </span>
                        <span
                          className={`font-['Inter'] text-[11px] mt-1 ${
                            isDone ? 'font-semibold text-[#352e24]' : 'font-medium text-[#837562]'
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                      {idx < 4 && (
                        <div
                          className={`h-0.5 flex-1 mx-1 -mt-4 ${
                            s.step < activeCase.currentStep ? 'bg-[#9c6743]' : 'bg-[#e5dac4]'
                          }`}
                        ></div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Before & After Comparison Tile */}
            <div className="mt-3 p-4 bg-[#efe7d6] rounded-xl space-y-2.5 border border-[#e5dac4]">
              <div className="flex items-center justify-between">
                <span className="font-['Inter'] text-xs font-semibold text-[#352e24]">
                  Distress Score Trajectory (Cohort Baseline)
                </span>
                <span className="font-['Inter'] text-xs text-[#8a6a4a] font-bold">
                  {activeCase.cohortImprovementPct}
                </span>
              </div>

              {/* Comparison Columns */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-white rounded-lg border border-[#e5dac4] shadow-xs">
                  <span className="font-['Inter'] text-[11px] text-[#837562] block">Before Intervention</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-['Plus_Jakarta_Sans'] text-2xl text-[#ba1a1a] font-bold">
                      {activeCase.distressBefore}
                    </span>
                    <span className="font-['Inter'] text-xs text-[#837562]">/ 100</span>
                  </div>
                  <span className="font-['Inter'] text-xs text-[#ba1a1a] block mt-0.5 font-medium">
                    {activeCase.distressBeforeLabel}
                  </span>
                </div>

                <div className="p-3 bg-[#e7d3b5]/30 rounded-lg border border-[#e7d3b5] shadow-xs">
                  <span className="font-['Inter'] text-[11px] text-[#837562] block">After 48h Follow-up</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-['Plus_Jakarta_Sans'] text-2xl text-[#8a6a4a] font-bold">
                      {activeCase.distressAfter}
                    </span>
                    <span className="font-['Inter'] text-xs text-[#8a6a4a] font-semibold">
                      {activeCase.distressDelta}
                    </span>
                  </div>
                  <span className="font-['Inter'] text-xs text-[#8a6a4a] block mt-0.5 font-medium">
                    {activeCase.distressAfterLabel}
                  </span>
                </div>
              </div>

              {/* Sparkline / Trend visual inline SVG */}
              <div className="pt-2">
                <svg className="w-full h-12 text-[#8a6a4a]" fill="none" viewBox="0 0 300 50">
                  <path
                    d="M0 15 Q 40 10, 80 40 T 160 30 T 240 15 T 300 38"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  ></path>
                  <circle cx="80" cy="40" fill="#ba1a1a" r="3.5"></circle>
                  <circle cx="300" cy="38" fill="#8a6a4a" r="4.5"></circle>
                </svg>
                <div className="flex justify-between text-[#837562] font-['Inter'] text-[11px] mt-1">
                  <span>Day 1 (Triage Spike)</span>
                  <span>Day 3 (Post Follow-up Call)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verified Certification Footer */}
          <div className="pt-3 border-t border-[#efe7d6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#8a6a4a] text-[20px]">verified_user</span>
              <span className="font-['Inter'] text-xs text-[#8a6a4a] font-semibold">
                Verified by Clinical Counsellor
              </span>
            </div>
            <button
              id="btn-view-audit-trail"
              type="button"
              onClick={onOpenAuditTrail}
              className="text-[#837562] hover:text-[#352e24] font-['Inter'] text-xs underline transition-colors"
            >
              View Protocol Audit Trail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
