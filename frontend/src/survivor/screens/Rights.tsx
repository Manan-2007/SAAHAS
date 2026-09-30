import React from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { RIGHTS } from '../data/rights';
import { Button } from '../ui/Button';
import { ScreenHeader, Stack } from '../ui/primitives';

// Legal support, said plainly. Each right folds away until it's wanted, so
// the screen reads as a short list, not a statute.

export const Rights: React.FC = () => {
  const { t, language } = useLanguage();
  const { back, navigate, isVictim, openHelplines } = useSurvivor();
  const lang = language === 'hi' ? 'hi' : 'en';

  return (
    <Stack gap="gap-4">
      <ScreenHeader title={t('support.legal')} onBack={back} />
      <p className="text-[17px] text-ink-2 break-soft">
        These come from the SC/ST (Prevention of Atrocities) Act and its Rules. If one of them isn’t happening for you, your
        counsellor can take it up.
      </p>

      <ul className="flex flex-col gap-2.5">
        {RIGHTS.map((r) => (
          <li key={r.title.en}>
            <details className="group rounded-card bg-surface border border-line open:bg-raised">
              <summary className="list-none cursor-pointer min-h-16 px-4 py-3 flex items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span className="flex-1 text-[16px] font-semibold text-ink break-soft">{r.title[lang]}</span>
                <ChevronDown className="w-5 h-5 text-ink-2 shrink-0 transition-transform duration-300 ease-soft group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-4 flex flex-col gap-3">
                <p className="text-[15px] text-ink leading-relaxed break-soft">{r.body[lang]}</p>
                <p className="text-[13px] text-ink-2 break-soft">{r.law}</p>
                {isVictim ? (
                  <Button variant="quiet" className="self-start" onClick={() => navigate('problem', { category: r.problem })}>
                    This isn’t happening for me
                  </Button>
                ) : (
                  <Button variant="quiet" className="self-start" onClick={openHelplines}>
                    Talk to someone about this
                  </Button>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>

      <section className="rounded-card bg-surface border border-line p-4 flex flex-col gap-3">
        <p className="text-[15px] text-ink-2 break-soft">
          This is general information, not legal advice. For your own situation, free legal aid is one call away.
        </p>
        <Button href="tel:15100" variant="accent" accent="coral" icon={Phone}>
          NALSA legal aid · 15100
        </Button>
      </section>
    </Stack>
  );
};
