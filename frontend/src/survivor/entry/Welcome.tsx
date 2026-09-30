import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { WindowSeat } from '../illustrations/scenes';
import { Button } from '../ui/Button';
import { LanguageSwitcher } from '../ui/forms';
import { Serif, Stack } from '../ui/primitives';
import { EntryShell } from './EntryShell';

/** The first thing anyone sees: a quiet room, their language, three ways in. */
export const Welcome: React.FC<{ onStart: () => void; onSignIn: () => void; onGuest: () => void; onStaff: () => void }> = ({
  onStart,
  onSignIn,
  onGuest,
  onStaff,
}) => {
  const { t, language, setLanguage } = useLanguage();

  return (
    <EntryShell wide>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-14 items-center lg:min-h-[calc(100dvh-8rem)] pt-2">
        <div className="max-w-[440px] w-full mx-auto lg:mx-0 settle" aria-hidden>
          <WindowSeat />
        </div>
        <Stack gap="gap-6" className="max-w-[440px] w-full mx-auto lg:mx-0">
          <div>
            <Serif as="h1" className="text-[40px] leading-[1.08] text-ink break-soft">{t('welcome.line')}</Serif>
            <p className="mt-3 text-[17px] text-ink-2 break-soft">{t('welcome.sub')}</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <p id="lang-label" className="text-[15px] font-semibold">{t('welcome.language')}</p>
            <LanguageSwitcher value={language} onChange={setLanguage} label={t('welcome.language')} />
          </div>

          <div className="flex flex-col gap-2.5">
            <Button variant="accent" accent="sun" size="lg" full iconRight={ArrowRight} onClick={onStart}>
              {t('welcome.start')}
            </Button>
            <Button variant="quiet" size="lg" full onClick={onSignIn}>
              {t('welcome.signin')}
            </Button>
            <div className="flex flex-col items-center text-center pt-1">
              <Button variant="ghost" onClick={onGuest}>
                {t('welcome.guest')}
              </Button>
              <p className="text-sm text-ink-2 -mt-1">{t('welcome.guestHint')}</p>
            </div>
            <button type="button" onClick={onStaff} className="self-center mt-4 min-h-11 px-2 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
              {t('welcome.staff')}
            </button>
          </div>
        </Stack>
      </div>
    </EntryShell>
  );
};
