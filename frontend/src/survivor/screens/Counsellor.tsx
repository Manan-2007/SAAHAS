import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Clock, Phone, PhoneCall } from 'lucide-react';
import type { ContactRequestView } from '../../lib/api';
import { useSurvivor } from '../SurvivorContext';
import {
  errorText,
  initials,
  requestCallback,
  sendCounsellorMessage,
  telHref,
  useMessages,
  useSupportInfo,
} from '../data/survivorData';
import { Button } from '../ui/Button';
import { CrisisBanner } from '../ui/CrisisBanner';
import { SafetyCard } from '../ui/SafetyCard';
import { TextArea } from '../ui/forms';
import { ChoiceGroup, Choice, Notice, Placeholder, ScreenHeader, Stack } from '../ui/primitives';
import { accentStyle } from '../ui/accents';

const TIMES: { id: NonNullable<ContactRequestView['preferred_time']>; label: string }[] = [
  { id: 'asap', label: 'As soon as possible' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const Counsellor: React.FC = () => {
  const { back, isVictim, reloadSupport, subscribe, raiseCrisis, crisis } = useSurvivor();
  const support = useSupportInfo(isVictim);
  const thread = useMessages(isVictim);
  const [time, setTime] = useState<NonNullable<ContactRequestView['preferred_time']>>('asap');
  const [note, setNote] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crisisVisible, setCrisisVisible] = useState(false);
  const [safety, setSafety] = useState(false);
  const threadBox = useRef<HTMLOListElement>(null);

  const { reload: reloadThread } = thread;
  const { reload: reloadInfo } = support;
  // Replies and call-back updates arrive live.
  useEffect(
    () =>
      subscribe((e) => {
        if (e.type === 'message') reloadThread();
        if (e.type === 'contact_request') reloadInfo();
      }),
    [subscribe, reloadThread, reloadInfo],
  );

  // Reading the thread marks it read: refresh the unread badge.
  useEffect(() => {
    if (thread.state.status === 'ready') reloadSupport();
  }, [thread.state.status, reloadSupport]);

  // Newest message in view, inside the thread's own box (the page stays put).
  useEffect(() => {
    const box = threadBox.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [thread.data?.length]);

  const info = support.data;
  const c = info?.counsellor ?? null;
  const name = c?.name ?? 'your counsellor';
  const openRequest = useMemo(
    () => info?.requests.find((r) => r.status !== 'done' && r.kind !== 'ivrs_callback') ?? info?.requests.find((r) => r.status !== 'done'),
    [info],
  );

  const ask = async () => {
    setRequesting(true);
    setError(null);
    try {
      await requestCallback(time, note.trim() || null);
      setNote('');
      support.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRequesting(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendCounsellorMessage(text);
      setDraft('');
      thread.mutate((list) => [...list, res.message]);
      if (res.crisis) {
        raiseCrisis(res.crisis_message);
        setCrisisVisible(true);
      }
      if (res.safety) setSafety(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack gap="gap-5">
      <ScreenHeader title="Your counsellor" onBack={back} />

      {crisisVisible && crisis && <CrisisBanner message={crisis} onDismiss={() => setCrisisVisible(false)} />}
      {safety && <SafetyCard onDismiss={() => setSafety(false)} />}
      {error && <Notice tone="error">{error}</Notice>}

      {support.state.status === 'loading' && !info ? (
        <Placeholder className="h-28" />
      ) : (
        <section style={accentStyle('coral')} className="rounded-card bg-surface border border-line p-4 flex flex-col gap-4">
          {c?.name ? (
            <div className="flex items-center gap-4">
              <span aria-hidden className="tactile w-14 h-14 shrink-0 rounded-full bg-(--accent) text-on-accent grid place-items-center text-[18px] font-bold">
                {initials(c.name)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[18px] font-semibold break-soft">{c.name}</p>
                <p className="text-sm text-ink-2 break-soft">your counsellor{c.hours ? ` · ${c.hours}` : ''}</p>
              </div>
              {c.phone && (
                <Button href={telHref(c.phone)} variant="accent" accent="coral" icon={Phone}>
                  Call
                </Button>
              )}
            </div>
          ) : (
            <p className="text-[15px] text-ink-2 break-soft">
              A counsellor will be assigned to you soon. Until then the helplines are open any time, and anything you write here
              is kept for them.
            </p>
          )}

          {openRequest ? (
            <div className="rounded-tile bg-raised px-4 py-3 flex items-start gap-3">
              <Clock className="w-5 h-5 text-ink-2 mt-0.5 shrink-0" aria-hidden />
              <p className="text-[15px] text-ink break-soft">
                {openRequest.status === 'acknowledged'
                  ? `${c?.name ?? 'Your counsellor'} has seen your request and will call you.`
                  : `You asked for a call ${openRequest.preferred_time === 'asap' ? 'as soon as possible' : `in the ${openRequest.preferred_time}`}. ${c?.name ?? 'Your counsellor'} has been told.`}
                {openRequest.response && <span className="block mt-1 text-ink-2">“{openRequest.response}”</span>}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[15px] font-semibold">Ask {name} to call you</p>
              <ChoiceGroup label="When would suit you?" className="grid grid-cols-2 gap-2">
                {TIMES.map((o) => (
                  <Choice key={o.id} accent="coral" selected={time === o.id} onSelect={() => setTime(o.id)}>
                    <span className="text-[15px]">{o.label}</span>
                  </Choice>
                ))}
              </ChoiceGroup>
              <TextArea label="Anything they should know first? (optional)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button variant="accent" accent="coral" size="lg" full icon={PhoneCall} busy={requesting} onClick={ask}>
                Request a call back
              </Button>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="thread" style={accentStyle('coral')} className="rounded-card bg-surface border border-line p-4 flex flex-col gap-3">
        <div>
          <h2 id="thread" className="text-[17px] font-semibold break-soft">Messages with {name}</h2>
          <p className="text-sm text-ink-2">A real person reads these, usually within a working day. In an emergency, call 112.</p>
        </div>
        <ol ref={threadBox} className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto" aria-live="polite">
          {thread.state.status === 'loading' && !thread.data ? (
            <li><Placeholder className="h-12" /></li>
          ) : !thread.data?.length ? (
            <li className="text-[15px] text-ink-2 py-2">No messages yet. Write whenever you like - there’s no wrong thing to say.</li>
          ) : (
            thread.data.map((m) => {
              const mine = m.sender === 'victim';
              return (
                <li key={m.id} className={`max-w-[86%] flex flex-col gap-1 ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                  <span className="sr-only">{mine ? 'You wrote' : `${name} wrote`}:</span>
                  <p
                    className={`px-4 py-2.5 text-[16px] leading-relaxed whitespace-pre-wrap break-soft ${
                      mine ? 'rounded-card rounded-br-[6px] bg-(--accent) text-on-accent' : 'rounded-card rounded-bl-[6px] bg-raised text-ink'
                    }`}
                  >
                    {m.text}
                  </p>
                  <span className="text-[12px] text-ink-2/80 px-1">{when(m.at)}</span>
                </li>
              );
            })
          )}
        </ol>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="to-counsellor" className="sr-only">Message to {name}</label>
          <textarea
            id="to-counsellor"
            rows={2}
            maxLength={4000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Write to ${name}…`}
            className="flex-1 min-h-14 rounded-tile bg-raised border border-line px-4 py-3 text-[16px] text-ink placeholder:text-ink-2/70 outline-none resize-none focus:border-ink-2"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || sending}
            className="tactile w-12 h-12 shrink-0 rounded-full bg-(--accent) text-on-accent grid place-items-center disabled:opacity-35"
          >
            <ArrowUp className="w-5 h-5" aria-hidden strokeWidth={2.4} />
          </button>
        </form>
      </section>
    </Stack>
  );
};
