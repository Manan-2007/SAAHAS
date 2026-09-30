import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { CaseUpcoming, Entitlement, EntitlementStatus } from '../../lib/api';
import { useLanguage } from '../../i18n/LanguageProvider';
import { EVENT_NOTE, dayLabel, monthDay, relativeKey } from '../data/survivorData';
import { accentStyle } from './accents';

/**
 * A date in the case, said gently. The label comes from the backend already
 * softened and translated ("A court date about your case") - the survivor
 * side never receives "bail", "parole" or "accused".
 */
export const UpcomingCard: React.FC<{
  event: CaseUpcoming;
  onPrepare?: () => void;
  eyebrow?: string;
  prepareLabel?: string;
}> = ({ event, onPrepare, eyebrow, prepareLabel }) => {
  const { t, language } = useLanguage();
  const { month, day } = monthDay(event, language);
  const rel = relativeKey(event.days_until);
  const note = EVENT_NOTE[event.kind];

  return (
    <article style={accentStyle('rose')} className="rounded-card bg-surface border border-line p-4 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div aria-hidden className="tactile shrink-0 w-16 h-[68px] rounded-tile bg-(--accent) text-on-accent flex flex-col items-center justify-center">
          <span className="text-[12px] font-bold uppercase tracking-wider leading-none">{month}</span>
          <span className="text-[26px] font-bold leading-none mt-1 tabular-nums">{day}</span>
        </div>
        <div className="flex-1 min-w-0">
          {eyebrow && <p className="text-[13px] font-semibold text-rose lowercase tracking-[0.03em]">{eyebrow}</p>}
          <h3 className="text-[17px] font-semibold text-ink break-soft">{event.label}</h3>
          <p className="text-[15px] text-ink-2 break-soft">
            {dayLabel(event, language)} · {t(rel.key, rel.n ? { n: rel.n } : undefined)}
          </p>
          {note && <p className="text-sm text-ink-2 mt-1 break-soft">{note}</p>}
        </div>
      </div>
      {onPrepare && (
        <button
          type="button"
          onClick={onPrepare}
          className="tactile-quiet self-start min-h-12 px-4 rounded-tile bg-raised border border-line text-ink text-[15px] font-semibold inline-flex items-center gap-2"
        >
          {prepareLabel ?? t('home.prepare')}
          <ArrowRight className="w-4 h-4" aria-hidden />
        </button>
      )}
    </article>
  );
};

const ANSWERS: { status: EntitlementStatus; key: 'ent.yes' | 'ent.notYet' | 'ent.notSure' }[] = [
  { status: 'received', key: 'ent.yes' },
  { status: 'not_received', key: 'ent.notYet' },
  { status: 'unknown', key: 'ent.notSure' },
];

/** "Did the support money arrive?" Three buttons, no amounts - ever. */
export const EntitlementCard: React.FC<{
  entitlement: Entitlement;
  onAnswer: (id: number, status: EntitlementStatus) => Promise<unknown>;
}> = ({ entitlement, onAnswer }) => {
  const { t } = useLanguage();
  const [answered, setAnswered] = useState<EntitlementStatus | null>(
    entitlement.status === 'due' ? null : entitlement.status,
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const answer = async (status: EntitlementStatus) => {
    setBusy(true);
    setFailed(false);
    try {
      await onAnswer(entitlement.id, status);
      setAnswered(status);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article style={accentStyle('rose')} className="rounded-card bg-surface border border-line p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-[17px] font-semibold text-ink">{t('ent.question')}</h3>
        <p className="text-[15px] text-ink-2 break-soft">{entitlement.label}</p>
      </div>
      <div role="group" aria-label={t('ent.question')} className="grid grid-cols-3 gap-2">
        {ANSWERS.map((a) => {
          const on = answered === a.status;
          return (
            <button
              key={a.status}
              type="button"
              disabled={busy}
              aria-pressed={on}
              onClick={() => answer(a.status)}
              className={`min-h-12 px-2 rounded-tile border text-[15px] font-semibold break-soft disabled:opacity-60 ${
                on ? 'tactile bg-(--accent) text-on-accent border-transparent' : 'tactile-quiet bg-raised text-ink border-line'
              }`}
            >
              {on && <Check className="inline w-4 h-4 mr-1 -mt-0.5" aria-hidden />}
              {t(a.key)}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-ink-2" role="status">
        {failed ? 'That didn’t send. Please try again.' : answered ? t('ent.thanks') : t('ent.noAmounts')}
      </p>
    </article>
  );
};
