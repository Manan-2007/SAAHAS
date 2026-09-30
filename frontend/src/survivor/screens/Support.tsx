import React from 'react';
import { CalendarHeart, ChevronRight, HeartHandshake, Megaphone, Phone, PhoneIncoming, Scale, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { ActionCard } from '../ui/ActionCard';
import { Button } from '../ui/Button';
import { CrisisBanner } from '../ui/CrisisBanner';
import { Notice, Serif, Stack } from '../ui/primitives';
import { Companions } from '../illustrations/scenes';

// A doorway, not an emergency room. If a real crisis signal has been seen
// this session, the free lines come first - no scrolling to find them.

export const SupportScreen: React.FC = () => {
  const { t } = useLanguage();
  const { lock } = useAuth();
  const { navigate, openHelplines, crisis, counsellor, unreadMessages, isVictim, missedCall } = useSurvivor();

  return (
    <Stack gap="gap-5">
      <header className="pt-4">
        <Serif as="h1" className="text-[40px] leading-[1.05] text-ink">{t('support.title')}</Serif>
        <p className="mt-2 text-[17px] text-ink-2">{t('support.sub')}</p>
      </header>

      {crisis && <CrisisBanner message={crisis} />}

      {!crisis && (
        <div className="max-w-[420px]" aria-hidden>
          <Companions />
        </div>
      )}

      <nav aria-label={t('nav.support')} className="flex flex-col gap-2.5">
        {isVictim ? (
          <ActionCard
            accent="coral"
            icon={HeartHandshake}
            title={t('support.counsellor')}
            hint={counsellor?.name ? `${counsellor.name}${counsellor.hours ? ` · ${counsellor.hours}` : ''}` : t('support.counsellorHint')}
            onClick={() => navigate('counsellor')}
            trailing={
              unreadMessages > 0 ? (
                <span className="min-w-7 h-7 px-2 rounded-full bg-coral text-on-accent text-[13px] font-bold grid place-items-center">
                  {unreadMessages}
                  <span className="sr-only"> new messages</span>
                </span>
              ) : undefined
            }
          />
        ) : (
          <Notice action={<Button variant="ghost" onClick={lock}>{t('home.guestCta')}</Button>}>
            A counsellor comes with an account. Every helpline works without one.
          </Notice>
        )}
        {isVictim && missedCall && (
          missedCall.enabled ? (
            <ActionCard
              accent="coral"
              icon={PhoneIncoming}
              title={t('support.missedCall')}
              hint={t('support.missedCallHint', { number: missedCall.number })}
              href={`tel:${missedCall.number.replace(/[^\d+]/g, '')}`}
            />
          ) : (
            <ActionCard
              accent="coral"
              icon={PhoneIncoming}
              title={t('support.missedCall')}
              hint={t('support.missedCallOff')}
              onClick={() => navigate('privacy')}
            />
          )
        )}
        <ActionCard accent="coral" icon={Phone} title={t('support.helpline')} hint={t('support.helplineHint')} onClick={openHelplines} />
        <ActionCard accent="coral" icon={Scale} title={t('support.legal')} hint={t('support.legalHint')} onClick={() => navigate('rights')} />
        <ActionCard accent="rose" icon={CalendarHeart} title={t('support.prepare')} hint={t('support.prepareHint')} onClick={() => navigate('prepare')} />
        {isVictim && (
          <ActionCard accent="coral" icon={Megaphone} title={t('support.problem')} hint={t('support.problemHint')} onClick={() => navigate('problem')} />
        )}
      </nav>

      <button
        type="button"
        onClick={() => navigate('privacy')}
        className="tactile-quiet w-full min-h-14 rounded-card border border-line px-4 flex items-center gap-3 text-left text-[15px] font-semibold text-ink"
      >
        <ShieldCheck className="w-5 h-5 text-ink-2" aria-hidden />
        <span className="flex-1">{t('support.privacy')}</span>
        <ChevronRight className="w-5 h-5 text-ink-3" aria-hidden />
      </button>
    </Stack>
  );
};
