import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { ApiError, DueCheckin, Questionnaire, Wellbeing, api } from '../lib/api';
import type { LanguageCode } from '../types';
import { CrisisBanner } from './CrisisBanner';

interface CheckInFlowProps {
  language: LanguageCode;
  onWellbeing: (w: Wellbeing) => void;
  onOpenCall: () => void;
}

type Stage =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'caught-up'; nextDue: string | null }
  | { kind: 'intro'; q: Questionnaire }
  | { kind: 'asking'; q: Questionnaire; index: number; answers: number[] }
  | { kind: 'saving' }
  | { kind: 'done'; crisis: boolean; crisisMessage: string | null };

// The backend decides what's due; full questionnaires come before the short pulse
function pickDue(due: DueCheckin[]): string | null {
  const open = due.filter((d) => d.due);
  return (open.find((d) => d.instrument !== 'phq4') ?? open[0])?.instrument ?? null;
}

function earliestNextDue(due: DueCheckin[]): string | null {
  return due.map((d) => d.next_due_at).filter((d): d is string => !!d).sort()[0] ?? null;
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : "We can't reach SAHAAS right now. Please try again in a moment.";

const CARD = 'bg-white rounded-3xl p-6 border border-[#e5dac4] shadow-xs flex flex-col gap-5';

// Screening questionnaires, one question per screen. The person never sees a
// score or the questionnaire's clinical name - only gentle words.
export const CheckInFlow: React.FC<CheckInFlowProps> = ({ language, onWellbeing, onOpenCall }) => {
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });

  const open = useCallback(
    async (instrument: string) => {
      setStage({ kind: 'loading' });
      try {
        setStage({ kind: 'intro', q: await api.questionnaire(instrument, language) });
      } catch (err) {
        setStage({ kind: 'error', message: errorText(err) });
      }
    },
    [language],
  );

  const load = useCallback(async () => {
    setStage({ kind: 'loading' });
    try {
      const due = await api.due();
      const next = pickDue(due);
      if (next) await open(next);
      else setStage({ kind: 'caught-up', nextDue: earliestNextDue(due) });
    } catch (err) {
      setStage({ kind: 'error', message: errorText(err) });
    }
  }, [open]);

  useEffect(() => {
    load();
  }, [load]);

  const answer = async (value: number) => {
    if (stage.kind !== 'asking') return;
    const answers = [...stage.answers.slice(0, stage.index), value];
    if (answers.length < stage.q.items.length) {
      setStage({ ...stage, index: stage.index + 1, answers });
      return;
    }
    setStage({ kind: 'saving' });
    try {
      const res = await api.submitQuestionnaire(stage.q.id, answers);
      onWellbeing(res.wellbeing);
      setStage({ kind: 'done', crisis: res.crisis, crisisMessage: res.crisis_message });
    } catch (err) {
      setStage({ kind: 'error', message: errorText(err) });
    }
  };

  if (stage.kind === 'loading' || stage.kind === 'saving') {
    return (
      <div className={`${CARD} items-center py-10 text-[#9c6743]`}>
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-xs font-semibold">{stage.kind === 'saving' ? 'Saving gently…' : 'Getting your check-in ready…'}</span>
      </div>
    );
  }

  if (stage.kind === 'error') {
    return (
      <div className={`${CARD} items-center text-center`}>
        <p className="text-sm text-[#5c5142]">{stage.message}</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9c6743] hover:underline">
          <RotateCcw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    );
  }

  if (stage.kind === 'caught-up') {
    return (
      <div className={`${CARD} items-center text-center`}>
        <div className="w-14 h-14 rounded-full bg-[#e7d3b5]/50 text-[#9c6743] flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#352e24]">You're all caught up</h3>
          <p className="text-xs text-[#5c5142] mt-1 max-w-sm">
            {stage.nextDue
              ? `Your next gentle check-in is on ${formatDay(stage.nextDue)}.`
              : 'There is nothing to answer right now.'}
          </p>
        </div>
        <button onClick={() => open('phq4')} className="text-xs font-semibold text-[#9c6743] hover:underline">
          Answer a few quick questions anyway
        </button>
      </div>
    );
  }

  if (stage.kind === 'done') {
    return (
      <div className={`${CARD} items-center text-center`}>
        {stage.crisis && (
          <div className="w-full text-left">
            <CrisisBanner message={stage.crisisMessage} onCall={onOpenCall} />
          </div>
        )}
        <div className="w-14 h-14 rounded-full bg-[#e7d3b5]/50 text-[#9c6743] flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#352e24]">Thank you for checking in</h3>
          <p className="text-xs text-[#5c5142] mt-1 max-w-sm">
            It's saved to your journey, and your counsellor can see it. There were no right or wrong answers.
          </p>
        </div>
        <button onClick={load} className="text-xs font-semibold text-[#9c6743] hover:underline">
          Done
        </button>
      </div>
    );
  }

  if (stage.kind === 'intro') {
    const { q } = stage;
    return (
      <div className={CARD}>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9c6743]">A gentle check-in</span>
          <h3 className="text-lg font-bold text-[#352e24] mt-0.5 leading-snug">{q.stem}</h3>
          <p className="text-xs text-[#5c5142] mt-2 leading-relaxed">
            {q.items.length} short questions, about two minutes. There are no right answers, and you can stop any time.
          </p>
        </div>
        <button
          onClick={() => setStage({ kind: 'asking', q, index: 0, answers: [] })}
          className="w-full py-3 rounded-2xl bg-[#9c6743] text-white font-semibold text-sm shadow-md hover:bg-[#835636] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>Begin</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const { q, index, answers } = stage;
  const item = q.items[index];
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between border-b border-[#e5dac4] pb-3 gap-3">
        <button
          onClick={() => setStage(index === 0 ? { kind: 'intro', q } : { ...stage, index: index - 1 })}
          className="p-1.5 rounded-lg text-[#8a7d68] hover:bg-[#efe7d6]"
          aria-label="Previous question"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-[#9c6743]">
          Question {index + 1} of {q.items.length}
        </span>
        <div className="w-20 h-1.5 rounded-full bg-[#e5dac4] overflow-hidden">
          <div className="h-full bg-[#9c6743] transition-all" style={{ width: `${((index + 1) / q.items.length) * 100}%` }} />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-[#8a7d68] leading-snug">{q.stem}</p>
        <h3 className="text-base font-bold text-[#352e24] mt-1.5 leading-snug">{item.text}</h3>
      </div>

      <div className="flex flex-col gap-2.5">
        {q.options.map((o) => (
          <button
            key={o.value}
            onClick={() => answer(o.value)}
            className={`p-3.5 rounded-xl border text-left text-sm font-medium transition-all active:scale-[0.99] ${
              answers[index] === o.value
                ? 'border-[#9c6743] bg-[#efe7d6] text-[#7a5a3f]'
                : 'border-[#e5dac4] hover:bg-[#f5f1e8] text-[#352e24]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
};
