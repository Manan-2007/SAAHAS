import React, { useEffect, useState } from 'react';
import { CaseData, NotificationItem } from '../types';
import { ApiError, VictimDetail, api } from '../../lib/api';
import { REASON_TITLES } from '../data/live';

interface QuickLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
}

// A privacy curtain for when someone walks past the screen. It is not a lock:
// signing out is what ends the session.
export const QuickLockModal: React.FC<QuickLockModalProps> = ({ isOpen, onUnlock }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-raised/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-surface max-w-sm w-full rounded-card p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-raised text-sun flex items-center justify-center mb-3">
          <span aria-hidden className="material-symbols-outlined text-[26px]">visibility_off</span>
        </div>

        <h3 className=" text-xl font-bold text-ink">Screen hidden</h3>
        <p className=" text-xs text-ink-2 mt-1 mb-5 max-w-xs">
          Client details are covered while you step away. To end the session on this device, sign out instead.
        </p>

        <button
          type="button"
          onClick={onUnlock}
          className="w-full py-2.5 rounded-lg bg-ink text-canvas text-sm font-semibold hover:bg-ink/90 transition-colors"
        >
          Show the screen again
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
      <div className="relative w-full max-w-md bg-surface h-full shadow-2xl flex flex-col z-50 animate-slideInRight">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden className="material-symbols-outlined text-sun text-[20px]">
              notifications_active
            </span>
            <h3 className=" font-semibold text-ink">
              Open Alerts
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs text-sun font-semibold hover:underline"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-md text-ink-2 hover:bg-raised"
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {notifications.length === 0 && (
            <p className="text-xs text-ink-2 text-center py-8">No open alerts. New ones appear here within a minute.</p>
          )}
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectCase(item.caseId);
                onClose();
              }}
              className={`p-3 rounded-tile cursor-pointer transition-all border ${
                item.severity === 'high'
                  ? 'bg-danger/15 border-danger/30 hover:bg-danger/15'
                  : 'bg-canvas border-line hover:bg-raised'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className=" text-xs font-semibold text-danger flex items-center gap-1">
                  {item.severity === 'high' && (
                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
                  )}
                  {item.caseName}
                </span>
                <span className="text-[10px] text-ink-2">{item.time}</span>
              </div>
              <h4 className=" text-xs font-bold text-ink mt-1">
                {item.title}
              </h4>
              <p className="text-[12px] text-ink-2 mt-1 leading-snug">
                {item.description}
              </p>
            </div>
          ))}
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

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Adds a counselling session to the victim's case dates (POST /counsellor/victims/{id}/events);
// they see it on their home screen.
export const ScheduleFollowUpModal: React.FC<ScheduleFollowUpModalProps> = ({
  isOpen,
  onClose,
  currentCase,
  onSchedule,
}) => {
  const [date, setDate] = useState(localToday);
  const [time, setTime] = useState('10:30');
  const [type, setType] = useState('Counselling call');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface max-w-md w-full rounded-card p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <span aria-hidden className="material-symbols-outlined text-sun">calendar_add_on</span>
            <h3 className=" font-bold text-lg text-ink">
              Schedule a Follow-up
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink">
            <span aria-hidden className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Client</label>
            <div className="p-2.5 rounded-lg bg-canvas border border-line text-xs font-medium text-ink">
              {currentCase.name} ({currentCase.number}) • {currentCase.status}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Session</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line text-xs bg-surface text-ink"
            >
              <option>Counselling call</option>
              <option>In-person counselling session</option>
              <option>Court preparation session</option>
              <option>Check-in call</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Date</label>
              <input
                type="date"
                value={date}
                min={localToday()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-line text-xs bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-2 rounded-lg border border-line text-xs bg-surface text-ink"
              />
            </div>
          </div>

          <div className="p-3 bg-raised rounded-tile text-xs text-ink-2">
            This adds the session to {currentCase.name}'s case dates, where they'll see it on their home screen.
            Arrange the call itself as you normally would.
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-line text-ink-2 hover:bg-raised text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!date}
            onClick={() => {
              onSchedule({ date, time, type });
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-ink text-canvas hover:bg-ink/90 text-xs font-semibold disabled:opacity-50"
          >
            Add to case dates
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

type HistoryItem = { at: string; title: string; text: string };

function historyOf(detail: VictimDetail): HistoryItem[] {
  const items: HistoryItem[] = [{ at: detail.created_at, title: 'Account created', text: 'Consent recorded at sign-up.' }];
  for (const a of detail.alerts) {
    items.push({ at: a.at, title: `${REASON_TITLES[a.reason] ?? 'Alert'} raised`, text: a.message });
    if (a.handled_at) {
      items.push({
        at: a.handled_at,
        title: `Alert ${a.status} by ${a.handled_by ?? 'a counsellor'}`,
        text: a.note ?? 'No note added.',
      });
    }
  }
  for (const q of detail.questionnaires) {
    items.push({ at: q.at, title: `${q.name} submitted`, text: `${q.total} / ${q.max_score} · ${q.severity}` });
  }
  return items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Who did what on this case, from the backend's records
export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  currentCase,
}) => {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    setItems(null);
    setError(null);
    api
      .victim(currentCase.id)
      .then((d) => live && setItems(historyOf(d)))
      .catch((err) => live && setError(err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend."));
    return () => {
      live = false;
    };
  }, [isOpen, currentCase.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface max-w-lg w-full rounded-card p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <span aria-hidden className="material-symbols-outlined text-sun">history</span>
            <h3 className=" font-bold text-lg text-ink">
              Case History • {currentCase.number}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink">
            <span aria-hidden className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1">
          {error && <p className="text-xs text-danger">{error}</p>}
          {!error && items === null && <p className="text-xs text-ink-2">Loading…</p>}
          {items?.map((item, i) => (
            <div key={i} className="p-3 bg-canvas rounded-tile border border-line">
              <div className="flex items-center justify-between text-xs text-ink-2 gap-2">
                <span className="font-semibold text-sun">{item.title}</span>
                <span className="shrink-0">{when(item.at)}</span>
              </div>
              <p className="text-xs font-medium text-ink mt-1">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
          <span className="text-xs text-ink-2 font-semibold flex items-center gap-1">
            <span aria-hidden className="material-symbols-outlined text-[16px]">lock</span>
            Encrypted at rest
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-ink text-canvas rounded-lg text-xs font-semibold hover:bg-ink/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
