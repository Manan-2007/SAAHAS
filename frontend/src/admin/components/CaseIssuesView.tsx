import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, CaseIssue, IssueStatus, LegalActions, api } from '../../lib/api';
import { timeShort, useLiveEvents } from '../liveBus';

const SOURCE_LABEL: Record<CaseIssue['source'], string> = {
  detected: 'Mentioned in conversation',
  insight: 'From the conversation summary',
  victim_report: 'Reported by the client',
  counsellor: 'Logged by you',
};

const STATUS_STYLE: Record<IssueStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#93000a', bg: '#ffdad6' },
  in_progress: { label: 'In progress', color: '#8a4b00', bg: '#fbdcae' },
  action_taken: { label: 'Action taken', color: '#7a4a30', bg: '#f3e6cf' },
  resolved: { label: 'Resolved', color: '#1f5c2a', bg: '#e3f1e4' },
  dismissed: { label: 'Dismissed', color: '#5c5142', bg: '#efe7d6' },
};

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend.");

let legalCache: LegalActions | null = null;
function useLegal() {
  const [legal, setLegal] = useState<LegalActions | null>(legalCache);
  useEffect(() => {
    if (legalCache) return;
    api.legalActions().then((l) => { legalCache = l; setLegal(l); }).catch(() => {});
  }, []);
  return legal;
}

// One problem, the legal steps that fit it, and everything done about it so far.
export const IssueCard: React.FC<{ issue: CaseIssue; onChanged: (i: CaseIssue) => void; onOpenCase?: (id: string) => void }> = ({
  issue, onChanged, onOpenCase,
}) => {
  const legal = useLegal();
  const [open, setOpen] = useState(issue.status === 'open');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = new Set((issue.actions ?? []).map((a) => a.action));
  const st = STATUS_STYLE[issue.status];

  const act = async (body: { status?: IssueStatus; action?: string; note?: string | null }) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await api.updateIssue(issue.id, body));
      setNote('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border shadow-xs ${issue.severity === 'high' && issue.status === 'open' ? 'border-[#f3b0ab]' : 'border-[#ece2ce]'}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-4 flex items-start gap-3">
        <span className={`material-symbols-outlined text-[22px] ${issue.severity === 'high' ? 'text-[#ba1a1a]' : 'text-[#9c6743]'}`}>
          {issue.category === 'threat' || issue.category === 'pressure_to_compromise' ? 'shield_person' : 'gavel'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[#352e24]">{issue.title}</span>
            {issue.severity === 'high' && <span className="text-[10px] font-bold text-white bg-[#ba1a1a] px-1.5 py-0.5 rounded">HIGH</span>}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
          </div>
          <p className="text-xs text-[#837562] mt-0.5">
            {onOpenCase && issue.victim_name ? (
              <span role="link" className="font-semibold text-[#9c6743] hover:underline"
                    onClick={(e) => { e.stopPropagation(); onOpenCase(issue.victim_id!); }}>{issue.victim_name}</span>
            ) : issue.victim_name}
            {issue.victim_name ? ' · ' : ''}{SOURCE_LABEL[issue.source]}
            {issue.occurrences > 1 ? ` · raised ${issue.occurrences} times` : ''} · last {timeShort(issue.last_seen_at)}
          </p>
        </div>
        <span className="material-symbols-outlined text-[#837562]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#efe7d6] pt-3">
          {issue.evidence && (
            <blockquote className="text-xs text-[#5c5142] italic bg-[#f5f1e8] rounded-lg p-2.5 border-l-4 border-[#c8a97e]">
              “{issue.evidence}” <span className="not-italic text-[10px] text-[#837562]">- the client’s words, kept with their consent</span>
            </blockquote>
          )}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#837562] mb-1.5">Steps you can take</p>
            <ol className="flex flex-col gap-1.5">
              {(issue.steps ?? []).map((s, i) => (
                <li key={s.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${done.has(s.id) ? 'bg-[#e3f1e4]/60' : 'bg-[#f5f1e8]'}`}>
                  <span className="w-5 h-5 rounded-full bg-white border border-[#e5dac4] text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#352e24] leading-relaxed">{s.text}</p>
                    {s.basis && (
                      <p className="text-[10px] text-[#837562] mt-0.5">
                        {s.basis}
                        {s.source && legal?.sources[s.source] && (
                          <> · <a href={legal.sources[s.source]} target="_blank" rel="noreferrer noopener" className="underline hover:text-[#9c6743]">source</a></>
                        )}
                      </p>
                    )}
                  </div>
                  {done.has(s.id) ? (
                    <span className="material-symbols-outlined text-[18px] text-[#2e7d32]">check_circle</span>
                  ) : (
                    <button disabled={busy} onClick={() => act({ action: s.id })}
                            className="text-[11px] font-semibold text-[#9c6743] hover:underline shrink-0 disabled:opacity-50">Done</button>
                  )}
                </li>
              ))}
            </ol>
            {legal && <p className="text-[10px] text-[#837562] mt-1.5">{legal.about}</p>}
          </div>

          {(issue.actions ?? []).length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#837562] mb-1">What has been done</p>
              <ul className="flex flex-col gap-1">
                {issue.actions!.map((a) => (
                  <li key={a.id} className="text-[11px] text-[#5c5142]">
                    <span className="font-mono text-[#837562]">{timeShort(a.at)}</span>{' '}
                    {a.action === 'status' ? `Status → ${a.note?.replace(/_/g, ' ')}` : a.action === 'note' ? 'Note' :
                      `Step: ${(issue.steps ?? []).find((s) => s.id === a.action)?.text.split('.')[0] ?? a.action}`}
                    {a.action !== 'status' && a.note ? ` - ${a.note}` : ''}{a.by ? ` (${a.by})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
                   placeholder="Add a note, e.g. Wrote to SP on 18 Sep, reference #..."
                   className="flex-1 px-3 py-1.5 rounded-lg border border-[#e5dac4] bg-white text-xs outline-none focus:border-[#9c6743]" />
            <button disabled={busy || !note.trim()} onClick={() => act({ note: note.trim() })}
                    className="px-3 py-1.5 rounded-lg bg-[#ece2ce] hover:bg-[#e5dac4] text-xs font-semibold disabled:opacity-50">Add note</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['in_progress', 'action_taken', 'resolved', 'dismissed'] as IssueStatus[]).filter((s) => s !== issue.status).map((s) => (
              <button key={s} disabled={busy} onClick={() => act({ status: s })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                        s === 'resolved' ? 'bg-[#9c6743] text-white hover:bg-[#b3654a]' : 'bg-white border border-[#e5dac4] text-[#5c5142] hover:bg-[#f5f1e8]'
                      }`}>
                {s === 'dismissed' ? 'Dismiss (not a real problem)' : `Mark ${STATUS_STYLE[s].label.toLowerCase()}`}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-[#93000a]">{error}</p>}
        </div>
      )}
    </div>
  );
};

interface CaseIssuesViewProps {
  onOpenCase: (victimId: string) => void;
  clients: { id: string; name: string }[];
  victimId?: string;           // set: one client's issues only (case detail tab)
}

export const CaseIssuesView: React.FC<CaseIssuesViewProps> = ({ onOpenCase, clients, victimId }) => {
  const legal = useLegal();
  const [status, setStatus] = useState<'active' | 'all'>('active');
  const [issues, setIssues] = useState<CaseIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<{ victim: string; category: string; note: string }>({ victim: victimId ?? '', category: '', note: '' });
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(() => {
    api.issues(status, victimId).then((i) => { setIssues(i); setError(null); }).catch((e) => setError(errorText(e)));
  }, [status, victimId]);
  useEffect(load, [load]);
  useLiveEvents((e) => { if (!victimId || e.victim_id === victimId) load(); }, ['issue']);

  const replace = (updated: CaseIssue) =>
    setIssues((prev) => (prev ?? []).map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));

  const submitLog = async () => {
    if (!log.victim || !log.category) return;
    try {
      await api.logIssue(log.victim, log.category, log.note.trim() || null);
      setLog({ victim: victimId ?? '', category: '', note: '' });
      setShowLog(false);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const open = (issues ?? []).filter((i) => i.status === 'open').length;
  const high = (issues ?? []).filter((i) => i.severity === 'high' && !['resolved', 'dismissed'].includes(i.status)).length;

  return (
    <div className="flex flex-col gap-4">
      {!victimId && (
        <div>
          <h1 className="text-2xl font-bold text-[#352e24]">Case problems &amp; legal action</h1>
          <p className="text-sm text-[#837562] mt-1 max-w-3xl">
            Problems with the police, courts, relief or safety - picked up from what clients say, what they report, and the
            conversation summaries. Each comes with the legal steps that fit it, cited to the Act, the Rules or BNSS.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!victimId && (
          <>
            <span className="px-3 py-1 rounded-full bg-[#ffdad6] text-[#93000a] text-xs font-bold">{high} serious</span>
            <span className="px-3 py-1 rounded-full bg-[#efe7d6] text-[#7a5a3f] text-xs font-bold">{open} not started</span>
          </>
        )}
        <div className="flex gap-1.5 ml-auto">
          {(['active', 'all'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === s ? 'bg-[#9c6743] text-white' : 'bg-white border border-[#e5dac4] text-[#5c5142]'}`}>
              {s === 'active' ? 'Needs action' : 'All'}
            </button>
          ))}
          <button onClick={() => setShowLog((v) => !v)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#e5dac4] text-[#9c6743]">
            {showLog ? 'Cancel' : '+ Log a problem'}
          </button>
        </div>
      </div>

      {showLog && (
        <div className="bg-white rounded-xl p-4 border border-[#e5dac4] grid grid-cols-1 md:grid-cols-4 gap-2">
          {!victimId && (
            <select value={log.victim} onChange={(e) => setLog((l) => ({ ...l, victim: e.target.value }))}
                    className="px-2.5 py-2 rounded-lg border border-[#e5dac4] text-xs">
              <option value="">Client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={log.category} onChange={(e) => setLog((l) => ({ ...l, category: e.target.value }))}
                  className="px-2.5 py-2 rounded-lg border border-[#e5dac4] text-xs">
            <option value="">Problem…</option>
            {legal && Object.entries(legal.categories).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}
          </select>
          <input value={log.note} onChange={(e) => setLog((l) => ({ ...l, note: e.target.value }))} placeholder="Note (optional)"
                 className={`px-2.5 py-2 rounded-lg border border-[#e5dac4] text-xs ${victimId ? 'md:col-span-2' : ''}`} />
          <button onClick={submitLog} disabled={!log.victim || !log.category}
                  className="px-3 py-2 rounded-lg bg-[#9c6743] text-white text-xs font-semibold disabled:opacity-50">Log it</button>
        </div>
      )}

      {error && <p className="text-xs text-[#93000a] bg-[#ffdad6]/60 rounded-lg px-3 py-2">{error}</p>}
      {issues === null ? (
        <p className="text-xs text-[#837562]">Loading…</p>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl p-6 border border-[#ece2ce] text-center">
          <p className="text-sm font-semibold text-[#352e24]">Nothing needs action</p>
          <p className="text-xs text-[#837562] mt-1">Problems appear here the moment a client mentions or reports one.</p>
        </div>
      ) : (
        issues.map((i) => <IssueCard key={i.id} issue={i} onChanged={replace} onOpenCase={victimId ? undefined : onOpenCase} />)
      )}
      {legal && <p className="text-[10px] text-[#837562]">{legal.caveat} Sources checked {legal.checked}.</p>}
    </div>
  );
};
