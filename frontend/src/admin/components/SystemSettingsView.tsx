import React, { useState } from 'react';

export const SystemSettingsView: React.FC = () => {
  const [zScoreThreshold, setZScoreThreshold] = useState(3.0);
  const [windowHours, setWindowHours] = useState(96);
  const [allowAudioTelemetry, setAllowAudioTelemetry] = useState(true);
  const [autoRankQueue, setAutoRankQueue] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9c6743] text-[24px]">settings</span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-xl text-[#352e24] font-bold">
              System Settings & Clinical Rubric
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#e5dac4] text-[#352e24] font-['Inter'] text-xs font-bold">
              Protocol v3.2
            </span>
          </div>
          <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
            Configure algorithmic boundaries, HIPAA encryption safeguards, and trauma-informed sensitivity.
          </p>
        </div>

        {saveSuccess && (
          <span className="text-xs font-semibold text-[#8a6a4a] bg-[#e7d3b5]/40 px-3 py-1.5 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Settings Successfully Deployed
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Algorithmic Thresholds */}
        <div className="lg:col-span-6 bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-5">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9c6743]">tune</span>
            Deterioration Detection Thresholds
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#352e24]">
                <span>Divergence Z-Score Sensitivity</span>
                <span className="text-[#9c6743] font-mono">{zScoreThreshold.toFixed(1)} σ</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="4.5"
                step="0.1"
                value={zScoreThreshold}
                onChange={(e) => setZScoreThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#9c6743] mt-2 cursor-pointer"
              />
              <p className="text-[11px] text-[#837562] mt-1">
                Lower triggers earlier silent deterioration alerts; higher minimizes false positive outreach.
              </p>
            </div>

            <div className="pt-3 border-t border-[#efe7d6]">
              <div className="flex justify-between text-xs font-semibold text-[#352e24]">
                <span>Rolling Baseline Observation Window</span>
                <span className="text-[#9c6743] font-mono">{windowHours} Hours</span>
              </div>
              <input
                type="range"
                min="48"
                max="168"
                step="12"
                value={windowHours}
                onChange={(e) => setWindowHours(parseInt(e.target.value))}
                className="w-full accent-[#9c6743] mt-2 cursor-pointer"
              />
              <p className="text-[11px] text-[#837562] mt-1">
                Current window matches 96-hour pre-court anticipatory stress detection curve.
              </p>
            </div>

            <div className="pt-3 border-t border-[#efe7d6] space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#352e24]">
                    Acoustic Biomarker Telemetry
                  </span>
                  <span className="text-[11px] text-[#837562]">
                    Process vocal pauses & micro-jitter without storing speech transcripts.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowAudioTelemetry}
                  onChange={(e) => setAllowAudioTelemetry(e.target.checked)}
                  className="w-5 h-5 rounded text-[#9c6743] accent-[#9c6743]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#352e24]">
                    Auto-Rank Triage Queue
                  </span>
                  <span className="text-[11px] text-[#837562]">
                    Order incoming cases automatically by urgency score and court proximity.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoRankQueue}
                  onChange={(e) => setAutoRankQueue(e.target.checked)}
                  className="w-5 h-5 rounded text-[#9c6743] accent-[#9c6743]"
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold shadow-xs transition-colors"
          >
            Apply Protocol Configuration
          </button>
        </div>

        {/* Right Column: HIPAA Vault & Security Status */}
        <div className="lg:col-span-6 bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-5">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#8a6a4a]">lock</span>
            HIPAA Vault & Data Governance
          </h3>

          <div className="space-y-3">
            <div className="p-3.5 bg-[#efe7d6] rounded-xl border border-[#e5dac4] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#9c6743] text-[20px]">
                  verified_user
                </span>
                <div>
                  <span className="text-xs font-semibold text-[#352e24] block">
                    Zero-Knowledge Encryption
                  </span>
                  <span className="text-[11px] text-[#837562]">
                    AES-256 GCM client-side encrypted payload
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#e7d3b5] text-[#7a5a3f] text-[10px] font-bold">
                Active
              </span>
            </div>

            <div className="p-3.5 bg-[#efe7d6] rounded-xl border border-[#e5dac4] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#9c6743] text-[20px]">
                  privacy_tip
                </span>
                <div>
                  <span className="text-xs font-semibold text-[#352e24] block">
                    Legal Privilege Firewall
                  </span>
                  <span className="text-[11px] text-[#837562]">
                    Subpoena immunity under counselor-client privilege rule 126
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#e7d3b5] text-[#7a5a3f] text-[10px] font-bold">
                Certified
              </span>
            </div>

            <div className="p-3.5 bg-[#efe7d6] rounded-xl border border-[#e5dac4] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#9c6743] text-[20px]">
                  history_edu
                </span>
                <div>
                  <span className="text-xs font-semibold text-[#352e24] block">
                    Cryptographic Audit Ledger
                  </span>
                  <span className="text-[11px] text-[#837562]">
                    Every algorithmic triage computation hashed and logged
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#e7d3b5] text-[#7a5a3f] text-[10px] font-bold">
                Verified
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#efe7d6]">
            <h4 className="text-xs font-bold text-[#352e24] mb-2 font-['Plus_Jakarta_Sans']">
              Explainable AI Rule Directory
            </h4>
            <div className="space-y-1.5 text-xs text-[#5c5142]">
              <div className="flex justify-between p-2 rounded bg-[#f5f1e8] border border-[#e5dac4]">
                <span className="font-mono text-[#9c6743]">Rule #E-94</span>
                <span>Conflicting multimodal signals & latency divergence</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#f5f1e8] border border-[#e5dac4]">
                <span className="font-mono text-[#9c6743]">Rule #V-42</span>
                <span>Acoustic vocal jitter above physiological norm</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#f5f1e8] border border-[#e5dac4]">
                <span className="font-mono text-[#9c6743]">Rule #D-12</span>
                <span>Passive touchpoint decay without explicit opt-out</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
