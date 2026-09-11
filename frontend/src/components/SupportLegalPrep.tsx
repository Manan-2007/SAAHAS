import React, { useState } from 'react';
import { 
  Shield, 
  FileText, 
  Phone, 
  CheckSquare, 
  Square, 
  ArrowLeft, 
  ExternalLink, 
  FolderLock, 
  Info, 
  Sparkles, 
  CheckCircle2, 
  UserCheck 
} from 'lucide-react';
import { EMERGENCY_HELPLINES, USER_PROFILE } from '../data/mockData';

interface SupportLegalPrepProps {
  onBack: () => void;
  onOpenCall: () => void;
}

export const SupportLegalPrep: React.FC<SupportLegalPrepProps> = ({ onBack, onOpenCall }) => {
  const [activeTab, setActiveTab] = useState<'prep' | 'vault' | 'helplines'>('prep');

  // Checklist state
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    'doc-id': true,
    'doc-advocate': true,
    'water': false,
    'support-person': true,
    'route': false,
  });

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 gap-5 pb-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-[#e5dac4] text-[#5c5142] hover:text-[#9c6743] flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="text-xs font-semibold text-[#9c6743] bg-[#efe7d6] px-3 py-1 rounded-full border border-[#e5dac4]">
          Trauma-Informed Legal Care
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#efe7d6] p-1 rounded-2xl border border-[#e5dac4] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('prep')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'prep'
              ? 'bg-white text-[#9c6743] shadow-2xs'
              : 'text-[#5c5142] hover:text-[#352e24]'
          }`}
        >
          Hearing Prep Guide
        </button>
        <button
          onClick={() => setActiveTab('vault')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'vault'
              ? 'bg-white text-[#9c6743] shadow-2xs'
              : 'text-[#5c5142] hover:text-[#352e24]'
          }`}
        >
          Encrypted Vault
        </button>
        <button
          onClick={() => setActiveTab('helplines')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'helplines'
              ? 'bg-white text-[#9c6743] shadow-2xs'
              : 'text-[#5c5142] hover:text-[#352e24]'
          }`}
        >
          24/7 Helplines
        </button>
      </div>

      {/* TAB 1: Court Hearing Prep Guide */}
      {activeTab === 'prep' && (
        <div className="flex flex-col gap-4">
          {/* Hearing Summary Card */}
          <div className="rounded-2xl bg-gradient-to-br from-[#9c6743] to-[#6f4a2f] text-white p-5 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-[#e7d3b5]">
                Next Scheduled Session
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-medium backdrop-blur-xs">
                District Session Court
              </span>
            </div>

            <div>
              <h3 className="text-xl font-bold">Court Hearing (District Session)</h3>
              <p className="text-xs text-white/80 mt-0.5">Thursday, Sep 14 · 10:30 AM · Courtroom #4</p>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/10 text-xs text-[#fffdf7] backdrop-blur-xs">
              <UserCheck className="w-4 h-4 text-[#e7d3b5] shrink-0" />
              <span>Advocate Meenakshi Sen & Support Liaison Dr. Ananya confirmed.</span>
            </div>
          </div>

          {/* Procedural Walkthrough */}
          <div className="bg-white rounded-2xl p-5 border border-[#e5dac4] shadow-xs flex flex-col gap-3">
            <h4 className="text-sm font-bold text-[#352e24] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#9c6743]" />
              <span>What to Expect Inside Court</span>
            </h4>

            <div className="space-y-3 text-xs text-[#5c5142] leading-relaxed">
              <div className="p-3 rounded-xl bg-[#f5f1e8] border border-[#e5dac4]/60">
                <strong className="text-[#352e24] block mb-1">1. Entering the courtroom:</strong>
                Your advocate will guide you to the designated victim/petitioner seating on the right side. You do not need to speak immediately.
              </div>

              <div className="p-3 rounded-xl bg-[#f5f1e8] border border-[#e5dac4]/60">
                <strong className="text-[#352e24] block mb-1">2. Procedural arguments:</strong>
                The advocates will exchange preliminary paperwork before the magistrate. You can keep your eyes softly focused on your counsel.
              </div>

              <div className="p-3 rounded-xl bg-[#f5f1e8] border border-[#e5dac4]/60">
                <strong className="text-[#352e24] block mb-1">3. Your protected right to a pause:</strong>
                If you feel dizzy, breathless, or triggered, you can whisper to your advocate to request a 5-minute recess for water.
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-2xl p-5 border border-[#e5dac4] shadow-xs flex flex-col gap-3">
            <h4 className="text-sm font-bold text-[#352e24]">Day-of Checklist</h4>
            <div className="flex flex-col gap-2">
              {[
                { id: 'doc-id', label: 'Government ID card (Aadhaar / Voter card)' },
                { id: 'doc-advocate', label: 'Advocate case file reference (DL-2026-F498A-082)' },
                { id: 'water', label: 'Comfort water bottle & breath mints' },
                { id: 'support-person', label: 'Confirmed support person companion' },
                { id: 'route', label: 'Planned departure 45 minutes prior for security queue' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#e5dac4] hover:bg-[#efe7d6] transition-colors text-left"
                >
                  {checkedItems[item.id] ? (
                    <CheckSquare className="w-5 h-5 text-[#9c6743] shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-[#8a7d68] shrink-0" />
                  )}
                  <span className={`text-xs font-medium ${checkedItems[item.id] ? 'line-through text-[#8a7d68]' : 'text-[#352e24]'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Encrypted Vault */}
      {activeTab === 'vault' && (
        <div className="bg-white rounded-2xl p-5 border border-[#e5dac4] shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[#9c6743]">
            <FolderLock className="w-5 h-5" />
            <h4 className="text-sm font-bold text-[#352e24]">Encrypted Document Safe</h4>
          </div>

          <p className="text-xs text-[#5c5142] leading-relaxed">
            Encrypted client-side storage for critical legal reference copies. Accessible only inside your active sanctuary session.
          </p>

          <div className="flex flex-col gap-2.5">
            {[
              { name: 'Interim Protection Order (Certified Copy).pdf', size: '2.4 MB', date: 'Uploaded Aug 28' },
              { name: 'Medical Forensic Evaluation Summary.pdf', size: '1.1 MB', date: 'Uploaded Sep 02' },
              { name: 'Advocate Meenakshi Sen Contact Memo.pdf', size: '420 KB', date: 'Uploaded Sep 05' },
            ].map((doc, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#efe7d6]/60 border border-[#e5dac4] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#9c6743]" />
                  <div>
                    <h5 className="text-xs font-semibold text-[#352e24]">{doc.name}</h5>
                    <span className="text-[10px] text-[#8a7d68]">{doc.size} · {doc.date}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-[#9c6743] bg-white px-2 py-1 rounded-md border border-[#e5dac4]">
                  Encrypted
                </span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-[#f5f1e8] rounded-xl border border-[#e5dac4] text-[11px] text-[#5c5142] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#9c6743] shrink-0" />
            <span>Files are decoupled from browser cloud backups to prevent discovery.</span>
          </div>
        </div>
      )}

      {/* TAB 3: 24/7 Helplines */}
      {activeTab === 'helplines' && (
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl p-4 border border-[#e5dac4] shadow-xs">
            <h4 className="text-sm font-bold text-[#352e24]">Verified National & Crisis Lines</h4>
            <p className="text-xs text-[#5c5142] mt-0.5">Direct toll-free lines with free trauma-informed responders.</p>
          </div>

          {EMERGENCY_HELPLINES.map((hl, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 border border-[#e5dac4] shadow-xs flex items-center justify-between gap-3"
            >
              <div>
                <span className="text-[10px] font-bold text-[#9c6743] uppercase tracking-wider">
                  {hl.type}
                </span>
                <h5 className="text-sm font-bold text-[#352e24] mt-0.5">{hl.title}</h5>
                <p className="text-xs text-[#8a7d68]">{hl.hours}</p>
              </div>

              <a
                href={`tel:${hl.number}`}
                className="px-4 py-2 rounded-xl bg-[#9c6743] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[#b3654a] active:scale-95 transition-all shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call {hl.number}</span>
              </a>
            </div>
          ))}

          {/* Counsellor Direct Call Card */}
          <div className="bg-[#efe7d6] rounded-2xl p-4 border border-[#e5dac4] flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#8a6a4a] uppercase tracking-wider">
                Personal Dedicated Counsellor
              </span>
              <h5 className="text-sm font-bold text-[#352e24] mt-0.5">{USER_PROFILE.assignedCounsellor}</h5>
              <p className="text-xs text-[#5c5142]">Toll-free priority line for Sunita</p>
            </div>

            <button
              onClick={onOpenCall}
              className="px-4 py-2 rounded-xl bg-[#8a6a4a] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-[#9c6743] active:scale-95 transition-all shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Connect Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
