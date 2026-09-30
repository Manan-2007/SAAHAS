import React from 'react';
import { Leaf, X } from 'lucide-react';
import { useT } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';

/**
 * Quick Exit: always here, always top-right, always the same - out of the
 * natural thumb arc so it isn't hit by accident, but one reach away when it
 * matters. Discreet, not alarming: it shouldn't draw an onlooker's eye.
 */
export const QuickExit: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onExit}
      aria-label={t('exit.aria')}
      title={t('exit.aria')}
      className="tactile-quiet min-h-12 min-w-12 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-tile bg-raised border border-line text-ink text-[15px] font-semibold"
    >
      <span>{t('exit.label')}</span>
      <X className="w-[18px] h-[18px]" aria-hidden strokeWidth={2.4} />
    </button>
  );
};

export const TopBar: React.FC = () => {
  const t = useT();
  const { navigate, quickExit, route } = useSurvivor();
  const breathing = route.name === 'breathe';

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-canvas/90 backdrop-blur-md safe-top">
      <div className="h-16 px-4 sm:px-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="min-h-12 -ml-1 px-1 text-[15px] font-extrabold tracking-[0.2em] text-ink"
          aria-label={`${t('app.name')}, ${t('nav.home')}`}
        >
          {t('app.name')}
        </button>
        <span className="flex-1" />
        {!breathing && (
          <button
            type="button"
            onClick={() => navigate('breathe')}
            aria-label={t('breathe.shortcut')}
            title={t('breathe.shortcut')}
            className="tactile-quiet w-12 h-12 mr-2 inline-flex items-center justify-center rounded-full border border-line bg-surface text-sage"
          >
            <Leaf className="w-5 h-5" aria-hidden />
          </button>
        )}
        <QuickExit onExit={quickExit} />
      </div>
    </header>
  );
};
