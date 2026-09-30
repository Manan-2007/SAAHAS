import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, CheckinCall, IvrsStep, api } from '../../lib/api';
import { timeShort, useLiveEvents } from '../liveBus';
import { TONE } from '../palette';
import { PageHeader } from './PageHeader';

const STATUS: Record<CheckinCall['status'], { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', ...TONE.low },
  calling: { label: 'Calling now', ...TONE.warn },
  completed: { label: 'Completed', ...TONE.ok },
  escalated: { label: 'Unreachable - call them', ...TONE.danger },
  cancelled: { label: 'Cancelled (checked in)', ...TONE.neutral },
};

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend.");

// Three kinds of call: a missed check-in, a callback after the person rang the
// missed-call number, and an evening check-in after a court date.
// Missed check-ins turn into a short automated call. The person can move it,
// but only twice and never past 72 hours - after that you're alerted to reach
// them yourself. This screen shows the queue and lets you walk a call through
// its steps without a phone carrier connected.
export const OutreachView: React.FC<{ onOpenCase: (id: string) => void }> = ({ onOpenCase }) => {
  const [status, setStatus] = useState<'active' | 'all'>('active');
  const [calls, setCalls] = useState<CheckinCall[] | null>(null);
  const [sim, setSim] = useState<{ call: CheckinCall; log: { who: 'system' | 'caller'; text: string }[]; step: IvrsStep | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.outreach(status).then(setCalls).catch((e) => setError(errorText(e)));
  }, [status]);
  useEffect(load, [load]);
  useLiveEvents(load, ['outreach']);

  const simulate = async (event: string, digits?: string) => {
    if (!sim) return;
    try {
      const step = await api.simulateCall(sim.call.id, event, digits);
      setSim((s) => s && ({
        ...s, step,
        log: [...s.log,
          ...(digits ? [{ who: 'caller' as const, text: `Pressed ${digits}` }] : event !== 'answered' ? [{ who: 'caller' as const, text: event.replace('_', ' ') }] : []),
          ...step.say.map((t) => ({ who: 'system' as const, text: t })),
          ...(step.hangup ? [{ who: 'system' as const, text: '(call ends)' }] : [])],
      }));
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Check-in calls"
        description="SAHAAS calls people who opted in (9am-8pm) with four keypad questions: when they miss a check-in, when they ring the missed-call number, and on the evening of a court date. A missed check-in can be moved twice, within 72 hours. No answer after three tries: you get an alert to reach them yourself."
      />
      <div className="flex gap-1.5">
        {(['active', 'all'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === s ? 'bg-ink text-canvas' : 'bg-surface border border-line text-ink-2'}`}>
            {s === 'active' ? 'Open' : 'All'}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger bg-danger/15 rounded-lg px-3 py-2">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 flex flex-col gap-2.5">
          {calls === null ? <p className="text-xs text-ink-2">Loading…</p> : calls.length === 0 ? (
            <div className="bg-surface rounded-tile p-6 border border-line text-center">
              <p className="text-sm font-semibold text-ink">No check-in calls pending</p>
              <p className="text-xs text-ink-2 mt-1">Calls are queued automatically for clients who opted in and gave a phone number.</p>
            </div>
          ) : calls.map((c) => {
            const st = STATUS[c.status];
            return (
              <div key={c.id} className={`bg-surface rounded-tile p-4 border ${c.status === 'escalated' ? 'border-danger/40' : 'border-line'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button onClick={() => onOpenCase(c.victim_id!)} className="text-sm font-bold text-ink hover:text-sun">{c.victim_name}</button>
                    <p className="text-xs text-ink-2">
                      {c.reason === 'missed_call'
                        ? `Rang the missed-call number at ${timeShort(c.missed_since)} - calling them back`
                        : c.reason === 'after_court'
                          ? 'Evening check-in after a court date today'
                          : `Check-in missed since ${timeShort(c.missed_since)}`}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px]">
                  <div><p className="text-ink-2">Next call</p><p className="font-semibold text-ink">{c.status === 'scheduled' ? timeShort(c.scheduled_for) : '—'}</p></div>
                  <div><p className="text-ink-2">Tries</p><p className="font-semibold text-ink">{c.attempts} of 3</p></div>
                  <div><p className="text-ink-2">Moves left</p><p className="font-semibold text-ink">{c.reschedules_left} of 2</p></div>
                  <div><p className="text-ink-2">Deadline</p><p className="font-semibold text-ink">{timeShort(c.deadline)}</p></div>
                </div>
                {(c.status === 'calling' || c.status === 'scheduled') && (
                  <button onClick={() => setSim({ call: c, log: [], step: null })}
                          className="mt-3 text-xs font-semibold text-sun hover:underline">Walk through this call (simulator)</button>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 bg-surface rounded-tile p-4 border border-line flex flex-col gap-3">
          <p className="text-sm font-bold text-ink">Call simulator</p>
          {!sim ? (
            <p className="text-xs text-ink-2 leading-relaxed">
              With no phone carrier connected, calls are logged rather than dialled. Pick a call on the left to hear exactly
              what the client would hear and try the keypad. Everything you press is real: a check-in is saved, a move uses
              up a reschedule.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-2">Call to {sim.call.victim_name}</p>
              <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto bg-canvas rounded-lg p-3">
                {sim.log.length === 0 && <p className="text-xs text-ink-2">Press “Answer” to start.</p>}
                {sim.log.map((l, i) => (
                  <p key={i} className={`text-xs ${l.who === 'caller' ? 'text-right text-sun font-semibold' : 'text-ink'}`}>{l.text}</p>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => simulate('answered')} className="px-3 py-1.5 rounded-lg bg-ink text-canvas text-xs font-semibold">Answer</button>
                {['0', '1', '2', '3'].map((d) => (
                  <button key={d} onClick={() => simulate('digits', d)} disabled={!sim.step || sim.step.hangup}
                          className="w-9 py-1.5 rounded-lg bg-surface border border-line text-sm font-bold disabled:opacity-40">{d}</button>
                ))}
                <button onClick={() => simulate('no_answer')} className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs">No answer</button>
                <button onClick={() => setSim(null)} className="px-3 py-1.5 rounded-lg text-xs text-ink-2">Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
