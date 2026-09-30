import React from 'react';
import { Phone, PhoneCall } from 'lucide-react';
import { useT } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { Sheet } from '../ui/Sheet';
import { accentStyle } from '../ui/accents';
import { telHref } from '../data/survivorData';

/** Every free line, one tap each. Opened from anywhere; never needs the backend. */
export const HelplineSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const t = useT();
  const { helplines, counsellor, isVictim, navigate } = useSurvivor();

  return (
    <Sheet open={open} onClose={onClose} title={t('support.helpline')}>
      <p className="text-[15px] text-ink-2 mb-4">{t('support.helplineHint')}.</p>
      <ul className="flex flex-col gap-2.5" style={accentStyle('coral')}>
        {helplines.map((h) => (
          <li key={h.number}>
            <a
              href={`tel:${h.number}`}
              className="tactile-quiet min-h-[72px] rounded-card bg-raised border border-line px-4 py-3 flex items-center gap-4"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] font-semibold text-ink break-soft">{h.name}</span>
                <span className="block text-sm text-ink-2 break-soft">{h.what}</span>
                <span className="block text-[13px] text-ink-2/80 mt-0.5">{h.hours}</span>
              </span>
              <span className="tactile shrink-0 min-h-12 px-3.5 rounded-tile bg-(--accent) text-on-accent font-bold text-[17px] inline-flex items-center gap-2 tabular-nums">
                <Phone className="w-4 h-4" aria-hidden />
                {h.number}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {counsellor?.phone ? (
        <a
          href={telHref(counsellor.phone)}
          className="tactile mt-4 min-h-14 rounded-tile bg-ink text-canvas font-semibold flex items-center justify-center gap-2 px-4"
        >
          <Phone className="w-5 h-5" aria-hidden />
          {t('crisis.counsellor')}
          {counsellor.name ? ` · ${counsellor.name}` : ''}
        </a>
      ) : (
        isVictim && (
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('counsellor');
            }}
            className="tactile mt-4 w-full min-h-14 rounded-tile bg-ink text-canvas font-semibold flex items-center justify-center gap-2 px-4"
          >
            <PhoneCall className="w-5 h-5" aria-hidden />
            {t('crisis.callback')}
          </button>
        )
      )}
    </Sheet>
  );
};
