import React from 'react';
import { Phone, PhoneCall } from 'lucide-react';
import { useT } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { CRISIS_LINES, telHref } from '../data/survivorData';
import { accentStyle } from './accents';

/**
 * Shown on any crisis: true (chat, voice, check-in, a message) - CLAUDE.md
 * says this is never weakened. The three free lines are one tap each, with
 * no scrolling, and the counsellor is right under them: a real call when we
 * know their number, otherwise a call-back request.
 */
export const CrisisBanner: React.FC<{ message?: string | null; onDismiss?: () => void }> = ({ message, onDismiss }) => {
  const t = useT();
  const { counsellor, isVictim, navigate } = useSurvivor();

  return (
    <section
      role="alert"
      aria-labelledby="crisis-title"
      style={accentStyle('coral')}
      className="soft-fade rounded-card bg-raised border border-line border-l-4 border-l-(--accent) p-4 flex flex-col gap-3"
    >
      <div>
        <p id="crisis-title" className="text-[17px] font-semibold text-ink break-soft">{t('crisis.title')}</p>
        <p className="mt-1 text-[15px] text-ink-2 break-soft">{message || t('crisis.sub')}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {CRISIS_LINES.map((line) => (
          <a
            key={line.number}
            href={`tel:${line.number}`}
            className="tactile min-h-16 rounded-tile bg-(--accent) text-on-accent flex flex-col items-center justify-center px-1 py-2 text-center"
          >
            <span className="text-[20px] font-bold leading-none tabular-nums">{line.number}</span>
            <span className="mt-1 text-[12px] font-semibold leading-tight break-soft">{t(line.key)}</span>
          </a>
        ))}
      </div>

      {counsellor?.phone ? (
        <a
          href={telHref(counsellor.phone)}
          className="tactile min-h-12 rounded-tile bg-ink text-canvas font-semibold flex items-center justify-center gap-2 px-4 text-[15px]"
        >
          <Phone className="w-5 h-5" aria-hidden />
          <span className="break-soft">{counsellor.name ? `${t('crisis.counsellor')} · ${counsellor.name}` : t('crisis.counsellor')}</span>
        </a>
      ) : (
        isVictim && (
          <button
            type="button"
            onClick={() => navigate('counsellor')}
            className="tactile min-h-12 rounded-tile bg-ink text-canvas font-semibold flex items-center justify-center gap-2 px-4 text-[15px]"
          >
            <PhoneCall className="w-5 h-5" aria-hidden />
            <span className="break-soft">{t('crisis.callback')}</span>
          </button>
        )
      )}

      {onDismiss && (
        <button type="button" onClick={onDismiss} className="self-center min-h-11 px-3 text-sm text-ink-2 hover:text-ink underline-offset-4 hover:underline">
          {t('crisis.dismiss')}
        </button>
      )}
    </section>
  );
};
