import React from 'react';
import { Anchor, Leaf, Mic, Sun } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { LATELY, isHeavy, useProgress, useWellbeing } from '../data/survivorData';
import { ActionCard } from '../ui/ActionCard';
import { Button } from '../ui/Button';
import { EmptyState, Eyebrow, Notice, Placeholder, ReflectionCard, Serif, Stack } from '../ui/primitives';
import { Resting } from '../illustrations/scenes';

// "Lately" - how things have been, in sentences. The backend sends trend
// words (never numbers) from the person's own check-ins; this turns them into
// what a friend would say. No chart, no meter, no colour-coded state.

export const WellbeingScreen: React.FC = () => {
  const { t } = useLanguage();
  const { user, lock } = useAuth();
  const { navigate, isVictim } = useSurvivor();
  const wellbeing = useWellbeing(isVictim);
  const warm = isVictim && user.uiStyle === 'warm';
  const progress = useProgress(warm);
  const w = wellbeing.data;

  const lines = w?.has_data ? [LATELY.energy[w.energy], LATELY.fatigue[w.fatigue], LATELY.stress[w.stress]] : [];
  const heavy = w?.has_data && [w.energy, w.fatigue, w.stress].some(isHeavy);

  const wins: string[] = [];
  const p = progress.data;
  if (p?.days_active_7d) wins.push(`you showed up for yourself on ${p.days_active_7d} ${p.days_active_7d === 1 ? 'day' : 'days'} this week.`);
  if (p?.conversations_7d) wins.push('you shared what was on your mind. that takes strength.');

  return (
    <Stack gap="gap-6">
      <header className="pt-4">
        <Serif as="h1" className="text-[44px] leading-none text-ink">{t('wb.title')}</Serif>
      </header>

      {!isVictim ? (
        <EmptyState
          art={<Resting />}
          title="This fills in over time."
          hint="Noticing how things have been needs your check-ins to be kept, which needs an account. Breathing and grounding work without one."
          action={<Button variant="quiet" onClick={lock}>{t('home.guestCta')}</Button>}
        />
      ) : wellbeing.state.status === 'loading' ? (
        <Placeholder className="h-56" />
      ) : wellbeing.state.status === 'error' ? (
        <Notice tone="offline" action={<Button variant="ghost" onClick={wellbeing.reload}>{t('common.tryAgain')}</Button>}>
          {t('offline.title')}
        </Notice>
      ) : !w?.has_data ? (
        <EmptyState
          art={<Resting />}
          title={t('wb.empty')}
          hint={t('wb.emptyHint')}
          action={<Button variant="accent" accent="sun" onClick={() => navigate('checkin')}>{t('wb.checkin')}</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {w.message && <p className="text-[17px] text-ink-2 break-soft">{w.message}</p>}
          <ReflectionCard lines={lines} closing={heavy ? t('wb.okay') : undefined} footnote={t('wb.fromCheckins')} />
        </div>
      )}

      {wins.length > 0 && (
        <section className="rounded-card bg-surface border border-line px-5 py-4 flex flex-col gap-2">
          {wins.map((line) => (
            <p key={line} className="text-[15px] text-ink flex items-start gap-2.5">
              <Sun className="w-4 h-4 mt-1 text-sun shrink-0" aria-hidden />
              {line}
            </p>
          ))}
        </section>
      )}

      <section aria-labelledby="tools" className="flex flex-col gap-2.5">
        <Eyebrow id="tools">{t('wb.tools')}</Eyebrow>
        <ActionCard accent="sun" icon={Sun} title={t('wb.checkin')} hint="one question, then only if you want more" onClick={() => navigate('checkin')} />
        <ActionCard accent="lilac" icon={Mic} title={t('wb.voice')} hint="say it out loud, no typing" onClick={() => navigate('voice-checkin')} />
        <ActionCard accent="sage" icon={Leaf} title={t('wb.breathe')} hint="gentle, or 4 · 7 · 8" onClick={() => navigate('breathe')} />
        <ActionCard accent="sage" icon={Anchor} title={t('wb.ground')} hint="5 · 4 · 3 · 2 · 1, one at a time" onClick={() => navigate('breathe', { mode: 'ground' })} />
      </section>
    </Stack>
  );
};
