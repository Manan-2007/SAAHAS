import React, { useState } from 'react';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import type { CourtDay, CourtDayAction } from '../../lib/api';
import { useSurvivor } from '../SurvivorContext';
import { accentStyle } from './accents';
import { Button } from './Button';

// Court-day mode: the day before, the day of and the evening after a court
// date, Home leads with this. Plain words, what to expect, what can be
// claimed - each legal point links to where it comes from. No docket words.

export const CourtDayCard: React.FC<{ day: CourtDay }> = ({ day }) => {
  const { navigate } = useSurvivor();
  const [hidden, setHidden] = useState(false);
  const [all, setAll] = useState(false);
  if (hidden) return null;
  const SHOWN = 3;
  const tips = all ? day.tips : day.tips.slice(0, SHOWN);

  const run = (a: CourtDayAction) => {
    if (a.kind === 'problem') navigate('problem', { category: a.category });
    else navigate(a.kind);
  };

  return (
    <section
      aria-labelledby="court-day-title"
      style={accentStyle('rose')}
      className="rounded-card bg-surface border border-line p-5 flex flex-col gap-4 settle"
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full grid place-items-center bg-(--accent)/20 text-(--accent) shrink-0" aria-hidden>
          <CalendarHeart className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 id="court-day-title" className="font-serif italic font-light tracking-[-0.01em] text-balance text-[26px] leading-[1.15] text-ink">{day.title}</h2>
          <p className="mt-1 text-[16px] text-ink-2 break-soft">{day.intro}</p>
        </div>
      </div>

      {day.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {day.actions.map((a, i) => (
            <Button key={a.kind} variant={i === 0 ? 'accent' : 'quiet'} accent="rose" onClick={() => run(a)}>
              {a.label}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => setHidden(true)}>Not now</Button>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-line">
        {tips.map((tip) => (
          <li key={tip.id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1.5">
            <p className="text-[15px] leading-snug text-ink break-soft">{tip.text}</p>
            {tip.action && (
              <button
                type="button"
                onClick={() => run(tip.action!)}
                className="self-start min-h-11 inline-flex items-center gap-1 text-[15px] font-semibold text-ink underline underline-offset-4"
              >
                {tip.action.label}
                <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            )}
            {tip.basis && tip.source_url && (
              <a href={tip.source_url} target="_blank" rel="noreferrer noopener" className="self-start text-[13px] text-ink-2 underline underline-offset-2">
                Where this comes from: {tip.basis}
              </a>
            )}
          </li>
        ))}
      </ul>
      {day.tips.length > SHOWN && (
        <Button variant="ghost" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show less' : `Show ${day.tips.length - SHOWN} more`}
        </Button>
      )}
    </section>
  );
};
