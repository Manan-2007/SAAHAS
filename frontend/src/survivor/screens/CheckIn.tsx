import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Leaf, MessageCircle, X } from 'lucide-react';
import type { Questionnaire } from '../../lib/api';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import {
  FEELINGS,
  Feeling,
  dueInstrument,
  errorText,
  replyKey,
  feelingKey,
  loadQuestionnaire,
  recordFeeling,
  submitQuestionnaire,
  useDue,
} from '../data/survivorData';
import { Button, IconButton } from '../ui/Button';
import { CrisisBanner } from '../ui/CrisisBanner';
import { Choice, ChoiceGroup, Notice, ProgressIndicator, Serif } from '../ui/primitives';

// One question at a time, big and unhurried. First: what feels closest right
// now (saved as a mood). Then, only if the backend says a questionnaire is
// due, an offer - never a demand - to answer a few more. Nothing afterwards
// shows a score; there isn't one on this side.

// How many questions each instrument has (backend.md §2), so the offer can
// say how long it takes before anything is loaded.
const QUESTION_COUNT: Record<string, number> = { phq9: 9, gad7: 7, pcptsd5: 5, phq4: 4 };

type Stage =
  | { kind: 'feeling' }
  | { kind: 'offer'; feeling: Feeling }
  | { kind: 'loading' }
  | { kind: 'asking'; q: Questionnaire; index: number; answers: number[] }
  | { kind: 'saving' }
  | { kind: 'done'; feeling: Feeling | null; saved: boolean }
  | { kind: 'error'; message: string; retry: () => void };

export const CheckIn: React.FC = () => {
  const { t, language } = useLanguage();
  const { back, navigate, isVictim, setLastFeeling, raiseCrisis, crisis } = useSurvivor();
  const due = useDue(isVictim);
  const [stage, setStage] = useState<Stage>({ kind: 'feeling' });
  const [picked, setPicked] = useState<Feeling | null>(null);
  const [crisisShown, setCrisisShown] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const instrument = dueInstrument(due.data);
  // Read when the offer is decided, not when the feeling was tapped: /me/due may land in between.
  const instrumentRef = useRef(instrument);
  instrumentRef.current = instrument;

  // Each new question is announced and focused, so a screen reader follows along.
  useEffect(() => {
    heading.current?.focus();
  }, [stage.kind, stage.kind === 'asking' ? stage.index : 0]);

  const chooseFeeling = (feeling: Feeling) => {
    setPicked(feeling);
    setLastFeeling(feeling);
    if (isVictim) recordFeeling(feeling).catch(() => {});
    // A breath before moving on, so the choice is seen to land.
    window.setTimeout(() => {
      setStage(isVictim && instrumentRef.current ? { kind: 'offer', feeling } : { kind: 'done', feeling, saved: isVictim });
    }, 320);
  };

  const begin = async () => {
    const chosen = instrumentRef.current;
    if (!chosen) return;
    setStage({ kind: 'loading' });
    try {
      const q = await loadQuestionnaire(chosen, language);
      setStage({ kind: 'asking', q, index: 0, answers: [] });
    } catch (err) {
      setStage({ kind: 'error', message: errorText(err), retry: begin });
    }
  };

  const answer = async (value: number) => {
    if (stage.kind !== 'asking') return;
    const answers = [...stage.answers.slice(0, stage.index), value];
    if (answers.length < stage.q.items.length) {
      window.setTimeout(() => setStage({ ...stage, index: stage.index + 1, answers }), 220);
      return;
    }
    const q = stage.q;
    const submit = async () => {
      setStage({ kind: 'saving' });
      try {
        const res = await submitQuestionnaire(q.id, answers);
        if (res.crisis) {
          raiseCrisis(res.crisis_message);
          setCrisisShown(true);
        }
        setStage({ kind: 'done', feeling: picked, saved: res.saved });
      } catch (err) {
        setStage({ kind: 'error', message: errorText(err), retry: submit });
      }
    };
    submit();
  };

  const total = stage.kind === 'asking' ? stage.q.items.length : 0;

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100dvh-8rem)]">
      <div className="flex items-center gap-3 settle">
        {stage.kind === 'asking' && stage.index > 0 ? (
          <IconButton icon={ArrowLeft} label={t('checkin.prev')} onClick={() => setStage({ ...stage, index: stage.index - 1 })} />
        ) : (
          <IconButton icon={X} label={t('common.close')} onClick={back} />
        )}
        <div className="flex-1">
          {stage.kind === 'asking' && (
            <ProgressIndicator
              current={stage.index + 1}
              total={total}
              label={t('checkin.progress', { i: stage.index + 1, n: total })}
            />
          )}
        </div>
        {stage.kind === 'asking' && (
          <span className="text-sm font-semibold text-ink-2 tabular-nums w-14 text-right">
            {t('checkin.progress', { i: stage.index + 1, n: total })}
          </span>
        )}
      </div>

      {stage.kind === 'feeling' && (
        <section key="feeling" className="flex flex-col gap-6 settle">
          <div>
            <h1 ref={heading} tabIndex={-1} className="outline-none text-[32px] leading-[1.15] font-semibold tracking-[-0.015em] break-soft">
              {t('checkin.question')}
            </h1>
            <Serif className="mt-2 text-[20px] text-ink-2">{t('checkin.questionHint')}</Serif>
          </div>
          <ChoiceGroup label={t('checkin.question')} className="grid grid-cols-2 gap-2.5">
            {FEELINGS.map((f) => (
              <Choice key={f} selected={picked === f} onSelect={() => chooseFeeling(f)} accent="sun">
                {t(feelingKey(f))}
              </Choice>
            ))}
          </ChoiceGroup>
        </section>
      )}

      {stage.kind === 'offer' && (
        <section key="offer" className="flex flex-col gap-6 settle">
          <Serif className="text-[26px] leading-[1.25] text-ink break-soft">{t(replyKey(stage.feeling))}</Serif>
          <div className="rounded-card bg-surface border border-line p-5 flex flex-col gap-4">
            <h1 ref={heading} tabIndex={-1} className="outline-none text-[22px] font-semibold break-soft">
              {t('checkin.moreTitle')}
            </h1>
            <p className="text-[15px] text-ink-2 -mt-2">
              {instrument && QUESTION_COUNT[instrument]
                ? t('checkin.moreHint', { n: QUESTION_COUNT[instrument] })
                : t('checkin.moreHintSome')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="accent" accent="sun" size="lg" full onClick={begin}>
                {t('checkin.moreYes')}
              </Button>
              <Button variant="quiet" size="lg" full onClick={() => setStage({ kind: 'done', feeling: stage.feeling, saved: true })}>
                {t('checkin.moreNo')}
              </Button>
            </div>
          </div>
        </section>
      )}

      {(stage.kind === 'loading' || stage.kind === 'saving') && (
        <p role="status" className="text-[17px] text-ink-2 hush pt-10 text-center">
          {stage.kind === 'saving' ? t('common.saving') : t('common.loading')}
        </p>
      )}

      {stage.kind === 'asking' && (
        <section key={`q${stage.index}`} className="flex flex-col gap-6 settle">
          <div>
            <p className="text-[15px] text-ink-2 break-soft">{stage.q.stem}</p>
            <h1 ref={heading} tabIndex={-1} className="outline-none mt-2 text-[26px] leading-[1.25] font-semibold break-soft">
              {stage.q.items[stage.index].text}
            </h1>
          </div>
          <ChoiceGroup label={stage.q.items[stage.index].text}>
            {stage.q.options.map((o) => (
              <Choice key={o.value} selected={stage.answers[stage.index] === o.value} onSelect={() => answer(o.value)} accent="sun">
                {o.label}
              </Choice>
            ))}
          </ChoiceGroup>
          <p className="text-sm text-ink-2">{t('checkin.canStop')}</p>
        </section>
      )}

      {stage.kind === 'error' && (
        <Notice tone="error" action={<Button variant="ghost" onClick={stage.retry}>{t('common.tryAgain')}</Button>}>
          {stage.message}
        </Notice>
      )}

      {stage.kind === 'done' && (
        <section key="done" className="flex flex-col gap-6 settle">
          {crisisShown && crisis && <CrisisBanner message={crisis} />}
          <div>
            <Serif as="h1" className="text-[34px] leading-[1.15] text-ink break-soft">
              <span ref={heading} tabIndex={-1} className="outline-none">{t('checkin.thanks')}</span>
            </Serif>
            {stage.feeling && !crisisShown && (
              <p className="mt-3 text-[17px] text-ink break-soft">{t(replyKey(stage.feeling))}</p>
            )}
            <p className="mt-2 text-[15px] text-ink-2 break-soft">{isVictim ? t('checkin.thanksHint') : t('checkin.thanksGuest')}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Button variant="accent" accent="sage" size="lg" icon={Leaf} full onClick={() => navigate('breathe')}>
              {t('checkin.next.breathe')}
            </Button>
            <Button variant="quiet" size="lg" icon={MessageCircle} full onClick={() => navigate('chat')}>
              {t('checkin.next.talk')}
            </Button>
            <Button variant="ghost" onClick={() => navigate('home')}>
              {t('checkin.next.home')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
};
