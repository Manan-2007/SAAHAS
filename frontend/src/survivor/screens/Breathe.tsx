import React, { useEffect, useState } from 'react';
import { Ear, Eye, Hand, Heart, Pause, Play, Wind, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageProvider';
import type { StringKey } from '../../i18n/strings';
import { useSurvivor } from '../SurvivorContext';
import { BreathPhase, BreathingOrb } from '../orbs/BreathingOrb';
import { Button, IconButton } from '../ui/Button';
import { ProgressIndicator, Serif } from '../ui/primitives';

// The quietest screen in the app. Almost nothing to read, one thing to do,
// and a way out that's always in the same place.

type Pattern = 'gentle' | '478';
const PATTERNS: Record<Pattern, { phase: Exclude<BreathPhase, 'rest'>; seconds: number }[]> = {
  // 4 in, 4 hold, 6 out: a longer out-breath tells the body it can slow down.
  gentle: [
    { phase: 'in', seconds: 4 },
    { phase: 'hold', seconds: 4 },
    { phase: 'out', seconds: 6 },
  ],
  '478': [
    { phase: 'in', seconds: 4 },
    { phase: 'hold', seconds: 7 },
    { phase: 'out', seconds: 8 },
  ],
};
const WORD: Record<Exclude<BreathPhase, 'rest'>, StringKey> = { in: 'breathe.in', hold: 'breathe.hold', out: 'breathe.out' };

const GROUND: { n: number; key: StringKey; icon: React.ElementType }[] = [
  { n: 5, key: 'ground.5', icon: Eye },
  { n: 4, key: 'ground.4', icon: Hand },
  { n: 3, key: 'ground.3', icon: Ear },
  { n: 2, key: 'ground.2', icon: Wind },
  { n: 1, key: 'ground.1', icon: Heart },
];

export const Breathe: React.FC<{ initialMode?: 'breathe' | 'ground' }> = ({ initialMode = 'breathe' }) => {
  const { t } = useLanguage();
  const { back } = useSurvivor();
  const [mode, setMode] = useState<'breathe' | 'ground'>(initialMode);

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100dvh-8rem)]">
      <div className="flex items-center gap-3 settle">
        <IconButton icon={X} label={t('common.close')} onClick={back} />
        <div role="tablist" aria-label={t('breathe.title')} className="flex-1 grid grid-cols-2 gap-1 p-1 rounded-tile bg-surface border border-line">
          {(['breathe', 'ground'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 rounded-[11px] text-[15px] font-semibold transition-colors duration-200 ${
                mode === m ? 'bg-raised text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {t(m === 'breathe' ? 'breathe.breathe' : 'breathe.ground')}
            </button>
          ))}
        </div>
      </div>
      {mode === 'breathe' ? <Breathing onDone={back} /> : <Grounding onDone={back} />}
    </div>
  );
};

const Breathing: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t } = useLanguage();
  const [pattern, setPattern] = useState<Pattern>('gentle');
  const [running, setRunning] = useState(false);
  // One state, one pure transition per second: which breath, how long left, rounds done.
  const [clock, setClock] = useState({ step: 0, left: PATTERNS.gentle[0].seconds, rounds: 0 });
  const { step, left, rounds } = clock;
  const steps = PATTERNS[pattern];
  const current = steps[step];

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setClock((c) => {
        if (c.left > 1) return { ...c, left: c.left - 1 };
        const next = (c.step + 1) % steps.length;
        return { step: next, left: steps[next].seconds, rounds: c.rounds + (next === 0 ? 1 : 0) };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, steps]);

  const choose = (p: Pattern) => {
    setPattern(p);
    setRunning(false);
    setClock({ step: 0, left: PATTERNS[p][0].seconds, rounds: 0 });
  };

  const toggle = () => setRunning((r) => !r);

  const phase: BreathPhase = running ? current.phase : 'rest';

  return (
    <section className="flex flex-col items-center text-center gap-5 settle" style={{ ['--i' as string]: 1 }}>
      <div className="min-h-[76px] flex flex-col items-center justify-end">
        {running ? (
          <p className="text-[30px] font-semibold tracking-[-0.01em]" aria-live="polite">
            {t(WORD[current.phase])}
          </p>
        ) : (
          <>
            <Serif as="h1" className="text-[36px] leading-none text-ink">{t('breathe.title')}</Serif>
            <p className="mt-2 text-[15px] text-ink-2 max-w-[30ch]">{t('breathe.intro')}</p>
          </>
        )}
      </div>

      <BreathingOrb phase={phase} seconds={current.seconds} size={260} />

      <div className="min-h-[88px] flex flex-col items-center">
        {running && (
          <>
            {current.phase === 'out' && <Serif className="text-[20px] text-ink-2">{t('breathe.slowly')}</Serif>}
            <p className="text-[44px] font-light tabular-nums leading-none mt-1 text-ink" aria-hidden>
              {left}
            </p>
          </>
        )}
        {!running && rounds > 0 && (
          <p className="text-[15px] text-ink-2" role="status">
            {rounds === 1 ? t('breathe.round') : t('breathe.rounds', { n: rounds })}
          </p>
        )}
      </div>

      <div className="w-full flex flex-col gap-3">
        <Button variant="accent" accent="sage" size="lg" full icon={running ? Pause : Play} onClick={toggle}>
          {running ? t('breathe.pause') : rounds > 0 || step > 0 ? t('breathe.resume') : t('breathe.start')}
        </Button>
        {!running && (
          <div role="radiogroup" aria-label={t('breathe.pattern')} className="grid grid-cols-2 gap-2">
            {(['gentle', '478'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={pattern === p}
                onClick={() => choose(p)}
                className={`min-h-12 rounded-tile border text-[15px] font-semibold ${
                  pattern === p ? 'bg-raised border-line-strong text-ink' : 'bg-transparent border-line text-ink-2 hover:text-ink'
                }`}
              >
                {p === 'gentle' ? `${t('breathe.gentle')} · 4 4 6` : t('breathe.478')}
              </button>
            ))}
          </div>
        )}
        {rounds > 0 && (
          <Button variant="ghost" onClick={onDone}>
            {t('breathe.finish')}
          </Button>
        )}
      </div>
    </section>
  );
};

const Grounding: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const done = step >= GROUND.length;
  const item = GROUND[Math.min(step, GROUND.length - 1)];
  const Icon = item.icon;

  return (
    <section className="flex flex-col items-center text-center gap-6 settle" style={{ ['--i' as string]: 1 }}>
      <p className="text-[15px] text-ink-2">{t('ground.intro')}</p>
      <ProgressIndicator current={Math.min(step + 1, GROUND.length)} total={GROUND.length} accent="sage" label={`${Math.min(step + 1, 5)} / 5`} />

      {done ? (
        <div key="done" className="flex flex-col items-center gap-4 py-10 settle">
          <Serif as="h1" className="text-[30px] leading-[1.2] text-ink max-w-[18ch]">{t('ground.done')}</Serif>
        </div>
      ) : (
        <div key={step} className="flex flex-col items-center gap-3 py-6 settle" aria-live="polite">
          <span className="tactile w-28 h-28 rounded-full bg-sage text-on-accent grid place-items-center">
            <span className="text-[56px] font-semibold leading-none tabular-nums">{item.n}</span>
          </span>
          <Icon className="w-6 h-6 text-sage mt-2" aria-hidden />
          <h1 className="text-[26px] font-semibold leading-tight max-w-[18ch] break-soft">{t(item.key)}</h1>
          <p className="text-[15px] text-ink-2">{t('ground.hint')}</p>
        </div>
      )}

      <div className="w-full flex flex-col gap-3">
        {done ? (
          <>
            <Button variant="accent" accent="sage" size="lg" full onClick={onDone}>
              {t('breathe.finish')}
            </Button>
            <Button variant="ghost" onClick={() => setStep(0)}>
              {t('ground.again')}
            </Button>
          </>
        ) : (
          <Button variant="accent" accent="sage" size="lg" full onClick={() => setStep((s) => s + 1)}>
            {t('ground.next')}
          </Button>
        )}
      </div>
    </section>
  );
};
