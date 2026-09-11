import React, { useState } from 'react';
import { CaseData } from '../types';

interface CaseDetailViewProps {
  caseData: CaseData;
  onOpenAuditTrail: () => void;
  onOpenScheduleFollowUp: () => void;
  onOpenAssignCounsellor: () => void;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseData,
  onOpenAuditTrail,
  onOpenScheduleFollowUp,
  onOpenAssignCounsellor,
}) => {
  const [activeTab, setActiveTab] = useState<'Acoustics' | 'Timeline' | 'Notes' | 'Consent'>('Acoustics');
  const [clinicalNotes, setClinicalNotes] = useState(
    `Case review at 09:30 AM:
Client exhibits elevated latency in daily check-in replies (avg 4.2h delay compared to 30-day norm). Acoustic features indicate vocal tension and micro-pauses (+68%), consistent with avoidance coping ahead of the District Court hearing in 3 days. 

Recommended action:
Immediate supportive pre-trial counseling call with Advocate Meera Sen on safe court navigation. Avoid alarming wording.`
  );
  const [savedNotesMessage, setSavedNotesMessage] = useState(false);

  const handleSaveNotes = () => {
    setSavedNotesMessage(true);
    setTimeout(() => setSavedNotesMessage(false), 3000);
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Top Patient Banner */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center font-['Plus_Jakarta_Sans'] text-xl font-bold shadow-xs">
              {caseData.initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-['Plus_Jakarta_Sans'] text-2xl text-[#352e24] font-bold">
                  {caseData.name}
                </h2>
                <span className="font-mono text-xs bg-[#efe7d6] px-2.5 py-1 rounded text-[#837562] font-semibold">
                  {caseData.number}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#ffdad6] text-[#ba1a1a] font-['Inter'] text-xs font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
                  {caseData.status}
                </span>
              </div>
              <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
                Client Since {caseData.registeredDate} • Primary Caregiver: {caseData.assignedCounsellor} • Legal Case #CR-2024-883
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenScheduleFollowUp}
              className="px-3 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">phone_in_talk</span>
              <span>Direct Secure Call</span>
            </button>
            <button
              type="button"
              onClick={onOpenAssignCounsellor}
              className="px-3 py-2 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-[#352e24] font-['Inter'] text-xs font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              <span>Reassign</span>
            </button>
            <button
              type="button"
              onClick={onOpenAuditTrail}
              className="p-2 rounded-lg bg-[#e5dac4] hover:bg-[#ddd0b8] text-[#5c5142]"
              title="Audit Log"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </button>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <div className="flex items-center gap-2 mt-5 pt-3 border-t border-[#efe7d6]">
          {[
            { id: 'Acoustics', label: 'Acoustic & Voice Signals', icon: 'graphic_eq' },
            { id: 'Timeline', label: 'Passive Divergence Timeline', icon: 'timeline' },
            { id: 'Notes', label: 'Encrypted Clinical Notes', icon: 'note_alt' },
            { id: 'Consent', label: 'Opt-in Trauma Rubric & Privacy', icon: 'shield' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Inter'] transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#9c6743] text-white font-semibold shadow-xs'
                  : 'text-[#837562] hover:bg-[#f5f1e8]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Acoustic & Voice Signals */}
      {activeTab === 'Acoustics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
                  Acoustic Micro-Pause & Tremor Waveform
                </h3>
                <p className="text-xs text-[#837562]">
                  Evaluating vocal harmonic consistency without storing raw linguistic recording.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold">
                Pitch Tremor Z-Score: +2.4
              </span>
            </div>

            {/* Simulated Spectrogram / Waveform Canvas graphic */}
            <div className="h-44 w-full bg-[#352e24] rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between text-[11px] font-mono text-[#e7d3b5]">
                <span>200Hz - Fundamental Frequency (F0)</span>
                <span>Active Sampling: 48kHz</span>
                <span>Pause Ratio: 68% Elevated</span>
              </div>

              {/* Waveform bars */}
              <div className="flex items-center justify-between gap-1 h-24 my-auto px-2">
                {[
                  12, 18, 35, 60, 42, 15, 8, 4, 3, 3, 12, 45, 80, 95, 70, 30, 15, 6, 4, 2, 2, 10,
                  25, 65, 88, 75, 40, 18, 9, 3, 2, 2, 8, 20, 50, 78, 62, 24, 10, 5, 2,
                ].map((val, idx) => (
                  <div
                    key={idx}
                    className={`w-full rounded-full transition-all ${
                      val > 70
                        ? 'bg-[#ba1a1a]'
                        : val < 10
                        ? 'bg-[#837562]/40'
                        : 'bg-[#e7d3b5]'
                    }`}
                    style={{ height: `${val}%` }}
                  />
                ))}
              </div>

              <div className="flex justify-between text-[10px] font-mono text-gray-400 border-t border-gray-800 pt-1">
                <span>0.00s</span>
                <span className="text-[#ffdad6]">Micro-pause Drift Zone (2.4s)</span>
                <span>12.50s</span>
              </div>
            </div>

            {/* Acoustic Metrics Detailed */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-[#f5f1e8] rounded-xl border border-[#e5dac4]">
                <span className="text-[11px] text-[#837562] font-['Inter']">Jitter Factor</span>
                <span className="text-xl font-bold text-[#ba1a1a] block mt-1">3.82%</span>
                <span className="text-[10px] text-[#ba1a1a]">Threshold &gt; 2.10%</span>
              </div>
              <div className="p-3 bg-[#f5f1e8] rounded-xl border border-[#e5dac4]">
                <span className="text-[11px] text-[#837562] font-['Inter']">Mean Pause Duration</span>
                <span className="text-xl font-bold text-[#ba1a1a] block mt-1">1.84 sec</span>
                <span className="text-[10px] text-[#ba1a1a]">+68% over baseline</span>
              </div>
              <div className="p-3 bg-[#f5f1e8] rounded-xl border border-[#e5dac4]">
                <span className="text-[11px] text-[#837562] font-['Inter']">Harmonic Noise Ratio</span>
                <span className="text-xl font-bold text-[#8a6a4a] block mt-1">18.4 dB</span>
                <span className="text-[10px] text-[#8a6a4a]">Within safe range</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
                Trauma Signal Correlation
              </h3>
              <p className="text-xs text-[#837562] mt-0.5">
                Multi-axis alignment between vocal tension and case events.
              </p>

              <div className="mt-4 space-y-3">
                <div className="p-3 bg-[#efe7d6] rounded-xl border border-[#e5dac4]">
                  <span className="text-xs font-semibold text-[#352e24] block">Court Docket Correlation</span>
                  <p className="text-xs text-[#5c5142] mt-1 leading-relaxed">
                    Acoustic tension spikes typically peak 72h before scheduled trial sessions. Client has not attended a pre-trial mock session yet.
                  </p>
                </div>

                <div className="p-3 bg-[#efe7d6] rounded-xl border border-[#e5dac4]">
                  <span className="text-xs font-semibold text-[#352e24] block">Diurnal Fatigue Cycle</span>
                  <p className="text-xs text-[#5c5142] mt-1 leading-relaxed">
                    Voice recordings taken after 8:00 PM display 40% higher jitter than morning check-ins, indicating sleep debt.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenScheduleFollowUp}
              className="w-full py-2.5 rounded-lg bg-[#9c6743] text-white font-['Inter'] text-xs font-semibold hover:bg-[#b3654a] transition-colors shadow-xs"
            >
              Order Clinical Acoustic Follow-Up
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Timeline */}
      {activeTab === 'Timeline' && (
        <div className="bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-4">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
            96-Hour Divergence & Event Timeline
          </h3>
          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e5dac4] pl-8">
            <div className="relative">
              <span className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-[#ba1a1a] border-2 border-white ring-2 ring-[#ffdad6]"></span>
              <span className="text-[11px] text-[#837562] font-mono">Today, 09:30 AM</span>
              <h4 className="text-sm font-bold text-[#352e24]">Silent Deterioration Threshold Triggered</h4>
              <p className="text-xs text-[#5c5142] mt-0.5">
                AI Rule #E-94 calculated composite Z-score of 3.1. Consecutive check-in latency exceeded 4 hours.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-white ring-2 ring-amber-100"></span>
              <span className="text-[11px] text-[#837562] font-mono">Yesterday, 07:15 PM</span>
              <h4 className="text-sm font-bold text-[#352e24]">Truncated Audio Log Submitted</h4>
              <p className="text-xs text-[#5c5142] mt-0.5">
                Voice note duration dropped to 6 seconds with noticeable acoustic tremor and sigh frequency.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-[#9c6743] border-2 border-white ring-2 ring-[#e7d3b5]"></span>
              <span className="text-[11px] text-[#837562] font-mono">3 Days Ago, 10:00 AM</span>
              <h4 className="text-sm font-bold text-[#352e24]">District Court Summons Notice Acknowledged</h4>
              <p className="text-xs text-[#5c5142] mt-0.5">
                Official court subpoena arrived for Section 498A hearing scheduled on trial docket.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Notes */}
      {activeTab === 'Notes' && (
        <div className="bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
                Encrypted Clinical Notes & Case Observations
              </h3>
              <p className="text-xs text-[#837562]">
                Protected under Doctor-Patient privilege and stored in HIPAA-compliant zero-knowledge vault.
              </p>
            </div>
            {savedNotesMessage && (
              <span className="text-xs font-semibold text-[#8a6a4a] bg-[#e7d3b5]/40 px-3 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Notes Saved & Timestamped
              </span>
            )}
          </div>

          <textarea
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            rows={8}
            className="w-full p-4 rounded-xl border border-[#e5dac4] bg-[#f5f1e8] text-xs text-[#352e24] font-['Inter'] leading-relaxed focus:outline-none focus:border-[#9c6743]"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSaveNotes}
              className="px-4 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>Save Encrypted Note</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Consent & Privacy */}
      {activeTab === 'Consent' && (
        <div className="bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-4">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
            Trauma-Informed Opt-in Sensors & Consent Matrix
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#efe7d6] rounded-xl border border-[#e5dac4]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#352e24]">Acoustic Jitter Analysis</span>
                <span className="px-2 py-0.5 rounded bg-[#e7d3b5] text-[#7a5a3f] text-[10px] font-bold">Active Opt-In</span>
              </div>
              <p className="text-xs text-[#5c5142] mt-1.5 leading-relaxed">
                Client authorized passive biometric voice tremor calculation. Audio files are processed in ephemeral memory and discarded within 60 seconds.
              </p>
            </div>

            <div className="p-4 bg-[#efe7d6] rounded-xl border border-[#e5dac4]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#352e24]">Check-in Frequency Telemetry</span>
                <span className="px-2 py-0.5 rounded bg-[#e7d3b5] text-[#7a5a3f] text-[10px] font-bold">Active Opt-In</span>
              </div>
              <p className="text-xs text-[#5c5142] mt-1.5 leading-relaxed">
                App monitors touchpoint intervals. No geolocation is ever recorded or shared with law enforcement or third parties.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
