import React, { useState } from 'react';
import { Check, HeartHandshake } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { answerEntitlement, pendingEntitlements, upcomingFrom, useCaseInfo } from '../data/survivorData';
import { WHAT_TO_BRING, WHAT_TO_EXPECT } from '../data/rights';
import { Button } from '../ui/Button';
import { EntitlementCard, UpcomingCard } from '../ui/CaseCards';
import { EmptyState, Eyebrow, Notice, Placeholder, ScreenHeader, Stack } from '../ui/primitives';
import { Desk } from '../illustrations/scenes';

// What's coming up, what to expect, what to bring - in that order, and in
// plain words. The dates and their labels come from the backend already
// softened; nothing here names a legal procedure the person didn't choose to read about.

const CHECKLIST_KEY = 'sahaas_court_checklist';

function loadChecked(): Record<string, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem(CHECKLIST_KEY) || '{}');
  } catch {
    return {};
  }
}

export const Prepare: React.FC = () => {
  const { t } = useLanguage();
  const { back, navigate, isVictim, openHelplines } = useSurvivor();
  const caseInfo = useCaseInfo(isVictim);
  const upcoming = upcomingFrom(caseInfo.data);
  const owed = pendingEntitlements(caseInfo.data);
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);

  const toggle = (id: string) =>
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        // This tab only: gone when SAHAAS closes, and wiped by Quick Exit.
        sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      } catch {
        /* private mode: kept for this visit */
      }
      return next;
    });

  return (
    <Stack gap="gap-5">
      <ScreenHeader title={t('support.prepare')} onBack={back} />

      <section aria-labelledby="dates" className="flex flex-col gap-3">
        <Eyebrow id="dates">{t('home.comingUp')}</Eyebrow>
        {!isVictim ? (
          <Notice>With an account, your counsellor adds your dates here as they’re set.</Notice>
        ) : caseInfo.state.status === 'loading' ? (
          <Placeholder className="h-32" />
        ) : caseInfo.state.status === 'error' ? (
          <Notice tone="offline" action={<Button variant="ghost" onClick={caseInfo.reload}>{t('common.tryAgain')}</Button>}>
            {t('offline.title')}
          </Notice>
        ) : upcoming.length === 0 ? (
          <div className="rounded-card bg-surface border border-line">
            <EmptyState art={<Desk />} title={t('upcoming.none')} hint={t('upcoming.noneHint')} />
          </div>
        ) : (
          upcoming.map((e, i) => <UpcomingCard key={e.id} event={e} eyebrow={i === 0 ? t('upcoming.title') : undefined} />)
        )}
      </section>

      <section aria-labelledby="expect" className="rounded-card bg-surface border border-line p-5 flex flex-col gap-3">
        <h2 id="expect" className="text-[18px] font-semibold">{t('home.prepare')}</h2>
        <ul className="flex flex-col gap-3">
          {WHAT_TO_EXPECT.map((line) => (
            <li key={line} className="text-[15px] text-ink-2 leading-relaxed flex gap-3 break-soft">
              <span aria-hidden className="mt-2.5 w-1.5 h-1.5 rounded-full bg-rose shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="bring" className="rounded-card bg-surface border border-line p-5 flex flex-col gap-3">
        <div>
          <h2 id="bring" className="text-[18px] font-semibold">What you may want to bring</h2>
          <p className="text-sm text-ink-2">Ticks stay on this phone only until SAHAAS closes.</p>
        </div>
        <ul className="flex flex-col gap-2">
          {WHAT_TO_BRING.map((item) => {
            const on = !!checked[item.id];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(item.id)}
                  className="tactile-quiet w-full min-h-14 rounded-tile border border-line bg-raised px-4 py-3 flex items-center gap-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`w-6 h-6 shrink-0 rounded-[7px] border-2 grid place-items-center transition-colors duration-200 ${
                      on ? 'bg-rose border-rose text-on-accent' : 'border-ink-3'
                    }`}
                  >
                    {on && <Check className="w-4 h-4" strokeWidth={3} />}
                  </span>
                  <span className={`text-[15px] break-soft ${on ? 'text-ink-2 line-through' : 'text-ink'}`}>{item.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Button variant="accent" accent="coral" size="lg" full icon={HeartHandshake} onClick={() => (isVictim ? navigate('counsellor') : openHelplines())}>
        {isVictim ? t('upcoming.prepareHint') : t('support.helpline')}
      </Button>

      {owed.length > 0 && (
        <section aria-labelledby="owed" className="flex flex-col gap-3">
          <Eyebrow id="owed">support you may be owed</Eyebrow>
          {owed.map((e) => (
            <EntitlementCard key={e.id} entitlement={e} onAnswer={(id, status) => answerEntitlement(id, status)} />
          ))}
        </section>
      )}
    </Stack>
  );
};
