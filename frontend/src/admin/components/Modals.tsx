import React, { useState } from 'react';
import { CaseData, NotificationItem } from '../types';

interface QuickLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
}

export const QuickLockModal: React.FC<QuickLockModalProps> = ({ isOpen, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleKeypad = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(false);
      if (nextPin.length === 4) {
        // any 4-digit PIN works, or default 1234
        setTimeout(() => {
          onUnlock();
          setPin('');
        }, 150);
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#352e24]/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-[26px]">lock</span>
        </div>

        <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#352e24]">
          Session Locked
        </h3>
        <p className="font-['Inter'] text-xs text-[#837562] mt-1 mb-5 max-w-xs">
          HIPAA & Clinical confidentiality guard active. Enter your 4-digit counsellor credentials or click Quick Unlock.
        </p>

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border border-[#9c6743] transition-all ${
                pin.length > idx ? 'bg-[#9c6743] scale-110' : 'bg-[#efe7d6]'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeypad(digit)}
              className="h-12 rounded-xl bg-[#f5f1e8] hover:bg-[#e5dac4] text-[#352e24] font-semibold text-lg transition-colors shadow-xs"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-xl bg-[#ffdad6]/50 hover:bg-[#ffdad6] text-[#ba1a1a] font-medium text-xs transition-colors flex items-center justify-center"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeypad('0')}
            className="h-12 rounded-xl bg-[#f5f1e8] hover:bg-[#e5dac4] text-[#352e24] font-semibold text-lg transition-colors shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={onUnlock}
            className="h-12 rounded-xl bg-[#9c6743] hover:bg-[#b3654a] text-white font-medium text-xs transition-colors flex items-center justify-center"
          >
            Bypass
          </button>
        </div>

        <button
          type="button"
          onClick={onUnlock}
          className="w-full py-2.5 rounded-lg bg-[#9c6743] text-white font-['Inter'] text-sm font-semibold hover:bg-[#b3654a] transition-colors mt-2"
        >
          Quick Resume Session
        </button>
      </div>
    </div>
  );
};

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onSelectCase: (caseId: string) => void;
  onMarkAllRead: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onSelectCase,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-50 animate-slideInRight">
        <div className="p-4 border-b border-[#ece2ce] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9c6743] text-[20px]">
              notifications_active
            </span>
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-[#352e24]">
              Clinical Alerts & Cues
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs text-[#9c6743] font-semibold hover:underline"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[#837562] hover:bg-[#ece2ce]"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectCase(item.caseId);
                onClose();
              }}
              className={`p-3 rounded-xl cursor-pointer transition-all border ${
                item.severity === 'high'
                  ? 'bg-[#ffdad6]/20 border-[#ffdad6] hover:bg-[#ffdad6]/30'
                  : 'bg-[#f5f1e8] border-[#e5dac4] hover:bg-[#ece2ce]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-['Inter'] text-xs font-semibold text-[#ba1a1a] flex items-center gap-1">
                  {item.severity === 'high' && (
                    <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
                  )}
                  {item.caseName}
                </span>
                <span className="text-[10px] text-[#837562]">{item.time}</span>
              </div>
              <h4 className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#352e24] mt-1">
                {item.title}
              </h4>
              <p className="text-[12px] text-[#5c5142] mt-1 leading-snug">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface AssignCounsellorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: CaseData;
  onAssign: (counsellor: string) => void;
}

export const AssignCounsellorModal: React.FC<AssignCounsellorModalProps> = ({
  isOpen,
  onClose,
  currentCase,
  onAssign,
}) => {
  const [selected, setSelected] = useState(currentCase.assignedCounsellor);

  if (!isOpen) return null;

  const counsellors = [
    { name: 'Dr. Ananya Sharma', role: 'Lead Trauma Specialist', activeCases: 14 },
    { name: 'Dr. Radhika Roy', role: 'Clinical Psychologist', activeCases: 12 },
    { name: 'Advocate Meera Sen', role: 'Trauma Legal Counselor', activeCases: 9 },
    { name: 'Sunaina Patel', role: 'Peer Support Specialist', activeCases: 18 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#ece2ce]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9c6743]">person_add</span>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#352e24]">
              Assign Counsellor
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#837562] hover:text-[#352e24]">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="mt-4 mb-2">
          <p className="font-['Inter'] text-xs text-[#837562]">
            Select certified trauma-informed caregiver for{' '}
            <strong className="text-[#352e24]">{currentCase.name}</strong> ({currentCase.number}):
          </p>
        </div>

        <div className="space-y-2 mt-3 mb-6">
          {counsellors.map((c) => (
            <label
              key={c.name}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                selected === c.name
                  ? 'border-[#9c6743] bg-[#efe7d6]'
                  : 'border-[#e5dac4] hover:bg-[#f5f1e8]'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="counsellor"
                  checked={selected === c.name}
                  onChange={() => setSelected(c.name)}
                  className="w-4 h-4 text-[#9c6743] accent-[#9c6743]"
                />
                <div>
                  <span className="font-semibold text-sm text-[#352e24] block">{c.name}</span>
                  <span className="text-xs text-[#837562]">{c.role}</span>
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-white text-[#8a6a4a] border border-[#e5dac4]">
                {c.activeCases} active
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#e5dac4] text-[#837562] hover:bg-[#f5f1e8] font-['Inter'] text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onAssign(selected);
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold shadow-xs"
          >
            Confirm Reassignment
          </button>
        </div>
      </div>
    </div>
  );
};

interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: CaseData;
  onSchedule: (details: { date: string; time: string; type: string }) => void;
}

export const ScheduleFollowUpModal: React.FC<ScheduleFollowUpModalProps> = ({
  isOpen,
  onClose,
  currentCase,
  onSchedule,
}) => {
  const [date, setDate] = useState('2026-09-12');
  const [time, setTime] = useState('10:30');
  const [type, setType] = useState('Trauma-Informed Voice Session');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#ece2ce]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9c6743]">calendar_add_on</span>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#352e24]">
              Schedule Follow-up Call
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#837562] hover:text-[#352e24]">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#837562] mb-1">
              Client & Protocol
            </label>
            <div className="p-2.5 rounded-lg bg-[#f5f1e8] border border-[#e5dac4] text-xs font-medium text-[#352e24]">
              {currentCase.name} ({currentCase.number}) • Silent Deterioration Safeguard
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#837562] mb-1">Session Modality</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#e5dac4] text-xs bg-white text-[#352e24]"
            >
              <option>Trauma-Informed Voice Session</option>
              <option>Legal Aid Court Preparation Briefing</option>
              <option>Discreet SMS Welfare Ping</option>
              <option>Protected In-Person Safe Space Escort</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#837562] mb-1">Target Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#e5dac4] text-xs bg-white text-[#352e24]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#837562] mb-1">Target Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#e5dac4] text-xs bg-white text-[#352e24]"
              />
            </div>
          </div>

          <div className="p-3 bg-[#efe7d6] rounded-xl text-xs text-[#5c5142]">
            <strong className="text-[#9c6743]">Trauma-Informed Notice:</strong> Call will be conducted through the encrypted masked proxy to safeguard client location.
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#e5dac4] text-[#837562] hover:bg-[#f5f1e8] font-['Inter'] text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSchedule({ date, time, type });
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold shadow-xs"
          >
            Schedule & Notify Caregiver
          </button>
        </div>
      </div>
    </div>
  );
};

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: CaseData;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  currentCase,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#ece2ce]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9c6743]">policy</span>
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#352e24]">
              Protocol Audit Trail • {currentCase.number}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#837562] hover:text-[#352e24]">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1">
          <div className="p-3 bg-[#f5f1e8] rounded-xl border border-[#e5dac4]">
            <div className="flex items-center justify-between text-xs text-[#837562]">
              <span className="font-mono text-[#9c6743]">SHA-256: 8f9b...a12c</span>
              <span>Today, 09:42 AM</span>
            </div>
            <p className="text-xs font-medium text-[#352e24] mt-1">
              Passive divergence threshold calculated (Z: 3.1). Acoustic pause drift flagged under Rule #E-94.
            </p>
          </div>

          <div className="p-3 bg-[#f5f1e8] rounded-xl border border-[#e5dac4]">
            <div className="flex items-center justify-between text-xs text-[#837562]">
              <span className="font-mono text-[#9c6743]">SHA-256: 4e7d...99b0</span>
              <span>Yesterday, 04:15 PM</span>
            </div>
            <p className="text-xs font-medium text-[#352e24] mt-1">
              Consent verification re-certified for opt-in acoustic biomarker telemetry.
            </p>
          </div>

          <div className="p-3 bg-[#f5f1e8] rounded-xl border border-[#e5dac4]">
            <div className="flex items-center justify-between text-xs text-[#837562]">
              <span className="font-mono text-[#9c6743]">SHA-256: 1a8c...ff32</span>
              <span>3 days ago, 11:20 AM</span>
            </div>
            <p className="text-xs font-medium text-[#352e24] mt-1">
              Legal Aid calendar linked: District Court hearing confirmed for upcoming docket.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-[#ece2ce] flex items-center justify-between">
          <span className="text-xs text-[#8a6a4a] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            HIPAA Compliant Immutable Ledger
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#9c6743] text-white rounded-lg text-xs font-semibold hover:bg-[#b3654a]"
          >
            Close Audit Log
          </button>
        </div>
      </div>
    </div>
  );
};
