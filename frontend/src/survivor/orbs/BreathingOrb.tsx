import React from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export type BreathPhase = 'rest' | 'in' | 'hold' | 'out';

const SCALE: Record<BreathPhase, number> = { rest: 0.6, in: 1, hold: 1, out: 0.5 };

/**
 * A flat sage disc that fills over the in-breath, waits on the hold and
 * empties over the out-breath. `seconds` is the length of the current phase,
 * so the easing always lasts exactly as long as the breath. With reduced
 * motion it doesn't move: the words and the count carry it.
 */
export const BreathingOrb: React.FC<{ phase: BreathPhase; seconds: number; size?: number }> = ({ phase, seconds, size = 260 }) => {
  const reduced = usePrefersReducedMotion();
  const scale = reduced ? 0.8 : SCALE[phase];
  const duration = reduced ? 0 : phase === 'rest' ? 0.6 : seconds;

  return (
    <div aria-hidden className="relative grid place-items-center" style={{ width: size, height: size, maxWidth: '100%' }}>
      <span className="absolute inset-0 rounded-full bg-sage/10" />
      <span
        className="breath-disc absolute inset-[9%] rounded-full bg-sage/20"
        style={{ transform: `scale(${Math.min(1, scale + 0.08)})`, transitionDuration: `${duration}s` }}
      />
      <span
        className="breath-disc absolute inset-[18%] rounded-full bg-sage"
        style={{ transform: `scale(${scale})`, transitionDuration: `${duration}s` }}
      >
        <span className="absolute left-[16%] top-[14%] w-[36%] h-[36%] rounded-full bg-[#a6d3aa]/55" />
      </span>
    </div>
  );
};
