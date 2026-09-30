import React, { useState } from 'react';
import { Leaf, Mic, PenLine, PhoneIncoming } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import {
  answerEntitlement,
  greetingKey,
  replyKey,
  rescheduleCall,
  unansweredEntitlements,
  upcomingFrom,
  useCaseInfo,
  useCheckinCall,
} from '../data/survivorData';
import { affirmationFor } from '../data/affirmations';
import { ActionCard } from '../ui/ActionCard';
import { Button } from '../ui/Button';
import { EntitlementCard, UpcomingCard } from '../ui/CaseCards';
import { Eyebrow, Notice, Serif, Stack } from '../ui/primitives';
import { Sprout } from '../illustrations/scenes';
import type { CheckinCall } from '../../lib/api';

// Home is a room, not a dashboard: a greeting, one invitation to check in,
// three quiet ways in, and only then - if there is one - the next thing on
// the calendar. No meters, no numbers, no colour that means "bad".

export const Home: React.FC = () => {
  const { t, language } = useLanguage();
  const { user, lock } = useAuth();
  const { navigate, isVictim, isGuest, lastFeeling } = useSurvivor();
  const caseInfo = useCaseInfo(isVictim);
  const call = useCheckinCall(isVictim);

  const firstName = user.role === 'guest' ? '' : user.name.trim().split(/\s+/)[0];
  // One date on Home. A court date is what people most need time to prepare
  // for, so it leads when there is one; otherwise whatever is soonest.
  const upcoming = upcomingFrom(caseInfo.data);
  const next = upcoming.find((e) => e.kind === 'court_date' || e.kind === 'date_changed') ?? upcoming[0];
  const toAsk = unansweredEntitlements(caseInfo.data)[0];

  return (
    <Stack gap="gap-5">
      <header className="pt-4 pb-1">
        <p className="text-[17px] text-ink-2 break-soft">
          {t(greetingKey())}
          {firstName && `, ${firstName}`}
        </p>
        {user.uiStyle === 'warm' && isVictim ? (
          <Serif as="h1" className="mt-1 text-[30px] leading-[1.18] text-ink break-soft">
            {affirmationFor(language)}
          </Serif>
        ) : (
          <Serif as="h1" className="mt-1 text-[40px] leading-[1.1] text-ink break-soft">
            {t('home.takeYourTime')}
          </Serif>
        )}
      </header>

      <ActionCard
        variant="hero"
        accent="sun"
        art={<Sprout className="max-w-[210px] mx-auto" />}
        title={lastFeeling ? t('home.checkedIn') : t('home.checkinPrompt')}
        hint={lastFeeling ? t(replyKey(lastFeeling)) : undefined}
        cta={lastFeeling ? t('home.checkedInCta') : t('home.checkinCta')}
        onClick={() => navigate('checkin')}
      />

      {call.data && <MissedCallCard call={call.data} onCheckIn={() => navigate('checkin')} onMoved={(c) => call.mutate(() => c)} />}

      <section aria-labelledby="today" className="flex flex-col gap-3">
        <Eyebrow id="today">{t('home.today')}</Eyebrow>
        <div className="grid grid-cols-2 gap-3">
          <ActionCard variant="tile" accent="lilac" icon={Mic} title={t('home.talk')} hint={t('home.talkHint')} onClick={() => navigate('voice')} />
          <ActionCard variant="tile" accent="iris" icon={PenLine} title={t('home.write')} hint={t('home.writeHint')} onClick={() => navigate('chat')} />
        </div>
        <ActionCard accent="sage" icon={Leaf} title={t('home.breathe')} hint={t('home.breatheHint')} onClick={() => navigate('breathe')} />
      </section>

      {next && (
        <section aria-labelledby="coming-up" className="flex flex-col gap-3">
          <Eyebrow id="coming-up">{t('home.comingUp')}</Eyebrow>
          <UpcomingCard
            event={next}
            eyebrow={t('upcoming.title')}
            onPrepare={next.kind === 'court_date' || next.kind === 'date_changed' ? () => navigate('prepare') : undefined}
          />
        </section>
      )}

      {toAsk && (
        <EntitlementCard
          key={toAsk.id}
          entitlement={toAsk}
          onAnswer={(id, status) => answerEntitlement(id, status)}
        />
      )}

      {isGuest && (
        <Notice action={<Button variant="ghost" onClick={lock}>{t('home.guestCta')}</Button>}>
          {t('home.guest')}
        </Notice>
      )}
    </Stack>
  );
};

/** A missed check-in call is on its way: check in here instead, or move it (up to twice). */
const MissedCallCard: React.FC<{ call: CheckinCall; onCheckIn: () => void; onMoved: (call: CheckinCall) => void }> = ({
  call,
  onCheckIn,
  onMoved,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const when = new Date(call.scheduled_for).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });

  const move = async (option: '1' | '2') => {
    setBusy(true);
    setError(null);
    try {
      onMoved(await rescheduleCall(option));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That call couldn’t be moved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-card bg-surface border border-line p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <PhoneIncoming className="w-5 h-5 mt-0.5 text-ink-2 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">We missed you at your check-in</h2>
          <p className="text-[15px] text-ink-2 break-soft">
            {call.status === 'calling' ? 'We’re trying to call you now.' : `We’ll give you a short call around ${when}.`} Or
            check in here, and there’s no need for a call.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="accent" accent="sun" onClick={onCheckIn}>
          Check in now
        </Button>
        {call.can_reschedule &&
          (call.options ?? []).map((o) => (
            <Button key={o.key} variant="quiet" busy={busy} onClick={() => move(o.key)}>
              {o.hours <= 2 ? 'Call me in 2 hours' : 'Call me tomorrow'}
            </Button>
          ))}
      </div>
      <p className="text-sm text-ink-2">
        {error ??
          (call.can_reschedule
            ? `You can move it ${call.reschedules_left} more ${call.reschedules_left === 1 ? 'time' : 'times'}.`
            : 'This one can’t be moved again. We just want to know you’re okay.')}
      </p>
    </section>
  );
};
