import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, CaseIssue, IssueStatus, LegalActions, api } from '../../lib/api';
import { timeShort, useLiveEvents } from '../liveBus';
import { TONE } from '../palette';
import { PageHeader } from './PageHeader';

const SOURCE_LABEL: Record<CaseIssue['source'], string> = {
  detected: 'Mentioned in conversation',
  insight: 'From the conversation summary',
  victim_report: 'Reported by the client',
  counsellor: 'Logged by you',
};

const STATUS_STYLE: Record<IssueStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', ...TONE.danger },
  in_progress: { label: 'In progress', ...TONE.warn },
  action_taken: { label: 'Action taken', ...TONE.low },
  resolved: { label: 'Resolved', ...TONE.ok },
  dismissed: { label: 'Dismissed', ...TONE.neutral },
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
    <div className={`bg-surface rounded-tile border ${issue.severity === 'high' && issue.status === 'open' ? 'border-danger/40' : 'border-line'}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-4 flex items-start gap-3">
        <span className={`material-symbols-outlined text-[22px] ${issue.severity === 'high' ? 'text-danger' : 'text-sun'}`}>
          {issue.category === 'threat' || issue.category === 'pressure_to_compromise' ? 'shield_person' : 'gavel'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-ink">{issue.title}</span>
            {issue.severity === 'high' && <span className="text-[10px] font-bold text-canvas bg-danger px-1.5 py-0.5 rounded">HIGH</span>}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
          </div>
          <p className="text-xs text-ink-2 mt-0.5">
            {onOpenCase && issue.victim_name ? (
              <span role="link" className="font-semibold text-sun hover:underline"
                    onClick={(e) => { e.stopPropagation(); onOpenCase(issue.victim_id!); }}>{issue.victim_name}</span>
            ) : issue.victim_name}
            {issue.victim_name ? ' · ' : ''}{SOURCE_LABEL[issue.source]}
            {issue.occurrences > 1 ? ` · raised ${issue.occurrences} times` : ''} · last {timeShort(issue.last_seen_at)}
          </p>
        </div>
        <span className="material-symbols-outlined text-ink-2">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-line pt-3">
          {issue.evidence && (
            <blockquote className="text-xs text-ink-2 italic bg-canvas rounded-lg p-2.5 border-l-4 border-sun">
              “{issue.evidence}” <span className="not-italic text-[10px] text-ink-2">- the client’s words, kept with their consent</span>
            </blockquote>
          )}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-2 mb-1.5">Steps you can take</p>
            <ol className="flex flex-col gap-1.5">
              {(issue.steps ?? []).map((s, i) => (
                <li key={s.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${done.has(s.id) ? 'bg-ok/15' : 'bg-canvas'}`}>
                  <span className="w-5 h-5 rounded-full bg-surface border border-line text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink leading-relaxed">{s.text}</p>
                    {s.basis && (
                      <p className="text-[10px] text-ink-2 mt-0.5">
                        {s.basis}
                        {s.source && legal?.sources[s.source] && (
                          <> · <a href={legal.sources[s.source]} target="_blank" rel="noreferrer noopener" className="underline hover:text-sun">source</a></>
                        )}
                      </p>
                    )}
                  </div>
                  {done.has(s.id) ? (
                    <span className="material-symbols-outlined text-[18px] text-ok">check_circle</span>
                  ) : (
                    <button disabled={busy} onClick={() => act({ action: s.id })}
                            className="text-[11px] font-semibold text-sun hover:underline shrink-0 disabled:opacity-50">Done</button>
                  )}
                </li>
              ))}
            </ol>
            {legal && <p className="text-[10px] text-ink-2 mt-1.5">{legal.about}</p>}
          </div>

          {(issue.actions ?? []).length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-2 mb-1">What has been done</p>
              <ul className="flex flex-col gap-1">
                {issue.actions!.map((a) => (
                  <li key={a.id} className="text-[11px] text-ink-2">
                    <span className="font-mono text-ink-2">{timeShort(a.at)}</span>{' '}
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
                   className="flex-1 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs outline-none focus:border-sun" />
            <button disabled={busy || !note.trim()} onClick={() => act({ note: note.trim() })}
                    className="px-3 py-1.5 rounded-lg bg-raised hover:bg-soft text-xs font-semibold disabled:opacity-50">Add note</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['in_progress', 'action_taken', 'resolved', 'dismissed'] as IssueStatus[]).filter((s) => s !== issue.status).map((s) => (
              <button key={s} disabled={busy} onClick={() => act({ status: s })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                        s === 'resolved' ? 'bg-ink text-canvas hover:bg-ink/90' : 'bg-surface border border-line text-ink-2 hover:bg-raised'
                      }`}>
                {s === 'dismissed' ? 'Dismiss (not a real problem)' : `Mark ${STATUS_STYLE[s].label.toLowerCase()}`}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
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
        <PageHeader
          title="Case problems"
          description="Problems with the police, courts, relief or safety - from what clients say and report. Each comes with the legal steps that fit it, cited to the Act, the Rules or BNSS."
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!victimId && (
          <>
            <span className="text-[13px] text-ink-2">
              <span className={`font-semibold ${high ? 'text-danger' : 'text-ink'}`}>{high}</span> serious ·{' '}
              <span className="font-semibold text-ink">{open}</span> not started
            </span>
          </>
        )}
        <div className="flex gap-1.5 ml-auto">
          {(['active', 'all'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === s ? 'bg-ink text-canvas' : 'bg-surface border border-line text-ink-2'}`}>
              {s === 'active' ? 'Needs action' : 'All'}
            </button>
          ))}
          <button onClick={() => setShowLog((v) => !v)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface border border-line text-sun">
            {showLog ? 'Cancel' : '+ Log a problem'}
          </button>
        </div>
      </div>

      {showLog && (
        <div className="bg-surface rounded-tile p-4 border border-line grid grid-cols-1 md:grid-cols-4 gap-2">
          {!victimId && (
            <select value={log.victim} onChange={(e) => setLog((l) => ({ ...l, victim: e.target.value }))}
                    className="px-2.5 py-2 rounded-lg border border-line text-xs">
              <option value="">Client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={log.category} onChange={(e) => setLog((l) => ({ ...l, category: e.target.value }))}
                  className="px-2.5 py-2 rounded-lg border border-line text-xs">
            <option value="">Problem…</option>
            {legal && Object.entries<LegalActions['categories'][string]>(legal.categories).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}
          </select>
          <input value={log.note} onChange={(e) => setLog((l) => ({ ...l, note: e.target.value }))} placeholder="Note (optional)"
                 className={`px-2.5 py-2 rounded-lg border border-line text-xs ${victimId ? 'md:col-span-2' : ''}`} />
          <button onClick={submitLog} disabled={!log.victim || !log.category}
                  className="px-3 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold disabled:opacity-50">Log it</button>
        </div>
      )}

      {error && <p className="text-xs text-danger bg-danger/15 rounded-lg px-3 py-2">{error}</p>}
      {issues === null ? (
        <p className="text-xs text-ink-2">Loading…</p>
      ) : issues.length === 0 ? (
        <div className="bg-surface rounded-tile p-6 border border-line text-center">
          <p className="text-sm font-semibold text-ink">Nothing needs action</p>
          <p className="text-xs text-ink-2 mt-1">Problems appear here the moment a client mentions or reports one.</p>
        </div>
      ) : (
        issues.map((i) => <IssueCard key={i.id} issue={i} onChanged={replace} onOpenCase={victimId ? undefined : onOpenCase} />)
      )}
      {legal && <p className="text-[10px] text-ink-2">{legal.caveat} Sources checked {legal.checked}.</p>}
    </div>
  );
};
