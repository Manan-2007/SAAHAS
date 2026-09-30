import React, { useState } from 'react';
import { CaseData } from '../types';
import { PageHeader } from './PageHeader';
import { needsYou } from '../data/live';

interface PriorityCasesViewProps {
  cases: CaseData[];
  onSelectCase: (caseId: string) => void;
  onNavigateToDetail: (caseId: string) => void;
}

type Filter = 'ALL' | 'HIGH' | 'DETERIORATION' | 'ACOUSTIC' | 'COURT';

const FILTERS: { id: Filter; label: string; test: (c: CaseData) => boolean }[] = [
  { id: 'ALL', label: 'Everyone', test: () => true },
  { id: 'HIGH', label: 'Need you first', test: needsYou },
  { id: 'DETERIORATION', label: 'Gone quiet', test: (c) => c.status.includes('Deterioration') },
  { id: 'ACOUSTIC', label: 'Voice distress', test: (c) => typeof c.fatigueMarker === 'number' && c.fatigueMarker >= 60 },
  {
    id: 'COURT',
    label: 'Court date soon',
    test: (c) => c.escalationReason.toLowerCase().includes('court') || c.keyHighlight.toLowerCase().includes('hearing'),
  },
];

const TONE_TEXT: Record<CaseData['statusType'], string> = {
  error: 'text-danger',
  amber: 'text-warn',
  success: 'text-ok',
  info: 'text-ink-2',
};
const TONE_DOT: Record<CaseData['statusType'], string> = {
  error: 'bg-danger',
  amber: 'bg-warn',
  success: 'bg-ok',
  info: 'bg-ink-3',
};

// The caseload as one calm table: who, how they are, what's happening, and
// the whole row opens their case.
export const PriorityCasesView: React.FC<PriorityCasesViewProps> = ({ cases, onNavigateToDetail }) => {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (c: CaseData) =>
    !q || c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q) || c.assignedCounsellor.toLowerCase().includes(q);
  const active = FILTERS.find((f) => f.id === filter)!;
  const rows = cases.filter((c) => matches(c) && active.test(c));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Caseload" description="Everyone in your care, most urgent first: crisis signals, then the highest Distress Score." />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter the caseload" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const count = cases.filter((c) => matches(c) && f.test(c)).length;
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                className={`h-8 px-3 rounded-lg text-[13px] transition-colors ${
                  on ? 'bg-raised text-ink font-semibold' : 'text-ink-2 hover:text-ink hover:bg-raised/60'
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-ink-2 font-normal tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        <label className="relative">
          <span className="sr-only">Search the caseload</span>
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2 text-[18px]" aria-hidden>
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or ID"
            className="h-9 pl-9 pr-3 rounded-lg border border-line bg-surface text-[13px] text-ink placeholder:text-ink-2/70 w-full md:w-64 focus:outline-none focus:border-line-strong"
          />
        </label>
      </div>

      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,2.4fr)_70px_70px_28px] gap-4 px-5 py-2.5 border-b border-line text-[12px] text-ink-2">
          <span>Person</span>
          <span>Status</span>
          <span>What's happening</span>
          <span className="text-right">Score</span>
          <span className="text-right">Voice</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-[14px] text-ink-2">No one matches this view.</p>
        ) : (
          <ul>
            {rows.map((c, i) => (
              <li key={c.id} className={i > 0 ? 'border-t border-line' : ''}>
                <button
                  type="button"
                  onClick={() => onNavigateToDetail(c.id)}
                  className="w-full text-left px-5 py-3.5 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,2.4fr)_70px_70px_28px] gap-x-4 gap-y-1 items-center hover:bg-raised/60 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-soft text-ink grid place-items-center text-[12px] font-bold shrink-0" aria-hidden>
                      {c.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-ink truncate">{c.name}</span>
                      <span className="block text-[12px] text-ink-2">
                        {c.number} · {c.timeAgo}
                      </span>
                    </span>
                  </span>
                  <span className={`flex items-center gap-1.5 text-[13px] font-medium min-w-0 ${TONE_TEXT[c.statusType]} max-md:col-start-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[c.statusType]}`} aria-hidden />
                    <span className="truncate">{c.status}</span>
                  </span>
                  <span className="text-[13px] text-ink-2 truncate max-md:col-start-1">{c.keyHighlight}</span>
                  <span className="hidden md:block text-right text-[14px] font-semibold text-ink tabular-nums">{c.wellbeingIndex}</span>
                  <span className="hidden md:block text-right text-[14px] text-ink-2 tabular-nums">{c.fatigueMarker}</span>
                  <span className="material-symbols-outlined text-[20px] text-ink-3 max-md:row-start-1 max-md:col-start-2 justify-self-end" aria-hidden>
                    chevron_right
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
