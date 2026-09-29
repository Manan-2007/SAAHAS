import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, ContactRequestView, CounsellorMessage, InboxRow, api } from '../../lib/api';
import { timeShort, useLiveEvents } from '../liveBus';

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend.");
const TIME_LABEL: Record<string, string> = { asap: 'As soon as possible', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const KIND_LABEL: Record<string, string> = { callback: 'Asked for a call back', talk_soon: 'Wants to talk soon', ivrs_callback: 'Asked for a call back on the check-in call' };

// A conversation with one client, used here and on the case page.
export const MessageThread: React.FC<{ victimId: string; victimName: string; compact?: boolean }> = ({ victimId, victimName, compact }) => {
  const [thread, setThread] = useState<CounsellorMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    api.thread(victimId).then(setThread).catch((e) => setError(errorText(e)));
  }, [victimId]);
  useEffect(() => { setThread(null); load(); }, [load]);
  useLiveEvents((e) => { if (e.victim_id === victimId) load(); }, ['message']);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [thread]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const m = await api.reply(victimId, text);
      setThread((t) => [...(t ?? []), m]);
      setDraft('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className={`flex flex-col gap-2 overflow-y-auto pr-1 ${compact ? 'max-h-80' : 'flex-1 min-h-[16rem] max-h-[28rem]'}`}>
        {thread === null ? <p className="text-xs text-[#837562]">Loading…</p> : thread.length === 0 ? (
          <p className="text-xs text-[#837562]">No messages with {victimName} yet. They see your messages in Support → My counsellor.</p>
        ) : thread.map((m) => (
          <div key={m.id} className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
            m.sender === 'counsellor' ? 'self-end bg-[#9c6743] text-white rounded-br-md' : 'self-start bg-[#efe7d6] text-[#352e24] rounded-bl-md'
          }`}>
            <p className="whitespace-pre-wrap">{m.text}</p>
            <span className={`block text-[10px] mt-0.5 ${m.sender === 'counsellor' ? 'text-white/70' : 'text-[#837562]'}`}>
              {timeShort(m.at)}{m.sender === 'counsellor' && m.read_at ? ' · read' : ''}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="flex gap-2">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={4000}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={`Reply to ${victimName}…`}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#e5dac4] text-sm outline-none focus:border-[#9c6743]" />
        <button onClick={send} disabled={busy || !draft.trim()}
                className="px-4 rounded-lg bg-[#9c6743] text-white text-xs font-semibold disabled:opacity-50">Send</button>
      </div>
      {error && <p className="text-xs text-[#93000a]">{error}</p>}
    </div>
  );
};

export const InboxView: React.FC<{ onOpenCase: (id: string) => void }> = ({ onOpenCase }) => {
  const [requests, setRequests] = useState<ContactRequestView[] | null>(null);
  const [inbox, setInbox] = useState<InboxRow[] | null>(null);
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.contactRequests('open').then(setRequests).catch((e) => setError(errorText(e)));
    api.inbox().then((rows) => {
      setInbox(rows);
      setSelected((s) => (s ? rows.find((r) => r.victim_id === s.victim_id) ?? s : rows[0] ?? null));
    }).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);
  useLiveEvents(load, ['message', 'contact_request']);

  const handle = async (r: ContactRequestView, status: 'acknowledged' | 'done') => {
    try {
      await api.handleContactRequest(r.id, status, responses[r.id]?.trim() || null);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-[#352e24]">Messages &amp; call-back requests</h1>
        <p className="text-sm text-[#837562] mt-1">What clients have asked of you directly. New ones appear here instantly.</p>
      </div>
      {error && <p className="text-xs text-[#93000a] bg-[#ffdad6]/60 rounded-lg px-3 py-2">{error}</p>}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-bold text-[#352e24]">Waiting for a call back {requests && requests.length > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#93000a] text-xs">{requests.length}</span>}</h2>
        {requests === null ? <p className="text-xs text-[#837562]">Loading…</p> : requests.length === 0 ? (
          <p className="text-xs text-[#837562] bg-white rounded-xl p-4 border border-[#ece2ce]">No one is waiting for a call.</p>
        ) : requests.map((r) => (
          <div key={r.id} className="bg-white rounded-xl p-4 border border-[#ece2ce] shadow-xs flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <button onClick={() => onOpenCase(r.victim_id!)} className="text-sm font-bold text-[#352e24] hover:text-[#9c6743]">{r.victim_name}</button>
                <p className="text-xs text-[#837562]">{KIND_LABEL[r.kind]} · {TIME_LABEL[r.preferred_time ?? 'asap']} · {timeShort(r.at)}</p>
                {r.note && <p className="text-xs text-[#5c5142] mt-1 italic">“{r.note}”</p>}
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.status === 'open' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#fbdcae] text-[#8a4b00]'}`}>
                {r.status === 'open' ? 'New' : 'Seen'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={responses[r.id] ?? ''} onChange={(e) => setResponses((x) => ({ ...x, [r.id]: e.target.value }))} maxLength={1000}
                     placeholder="A short note they will see, e.g. I'll call you at 4pm today"
                     className="flex-1 px-3 py-1.5 rounded-lg border border-[#e5dac4] text-xs outline-none focus:border-[#9c6743]" />
              {r.status === 'open' && (
                <button onClick={() => handle(r, 'acknowledged')} className="px-3 py-1.5 rounded-lg bg-[#ece2ce] text-xs font-semibold">Seen - will call</button>
              )}
              <button onClick={() => handle(r, 'done')} className="px-3 py-1.5 rounded-lg bg-[#9c6743] text-white text-xs font-semibold">Called - done</button>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#ece2ce] shadow-xs divide-y divide-[#efe7d6]">
          <p className="p-3 text-xs font-bold text-[#837562] uppercase tracking-wider">Conversations</p>
          {inbox === null ? <p className="p-3 text-xs text-[#837562]">Loading…</p> : inbox.length === 0 ? (
            <p className="p-3 text-xs text-[#837562]">No messages yet.</p>
          ) : inbox.map((row) => (
            <button key={row.victim_id} onClick={() => setSelected(row)}
                    className={`w-full text-left p-3 flex items-start gap-2 ${selected?.victim_id === row.victim_id ? 'bg-[#f5f1e8]' : 'hover:bg-[#faf7f0]'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#352e24]">{row.victim_name}</p>
                <p className="text-xs text-[#837562] truncate">{row.last.sender === 'counsellor' ? 'You: ' : ''}{row.last.text}</p>
              </div>
              {row.unread > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-[#ba1a1a] text-white text-[10px] font-bold flex items-center justify-center">{row.unread}</span>}
            </button>
          ))}
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-[#ece2ce] shadow-xs flex flex-col gap-2">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#352e24]">{selected.victim_name}</p>
                <button onClick={() => onOpenCase(selected.victim_id)} className="text-xs font-semibold text-[#9c6743] hover:underline">Open case</button>
              </div>
              <MessageThread victimId={selected.victim_id} victimName={selected.victim_name} />
            </>
          ) : <p className="text-xs text-[#837562]">Pick a conversation.</p>}
        </div>
      </section>
    </div>
  );
};
