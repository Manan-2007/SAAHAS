import React, { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// Something quietly listening. Flat lilac shapes, no neon, no face.
//
//   idle       small and still, a very slow breath
//   connecting a soft pulse while the line opens
//   listening  slow breathing expansion, waiting
//   (voice)    while the mic hears speech, it swells and trembles with it
//   thinking   a slow turn of the outer ring
//   replying   SAAHAS is speaking: a softer, slower wave from the outside in
//   finished   settles back down and stops
//   offline    grey, still
//
// Levels are 0-255 (converseApi / emotionApi). Shapes are redrawn with refs
// on animation frames, not React state, so a 60 fps orb costs no re-renders.

export type OrbMode = 'idle' | 'connecting' | 'listening' | 'thinking' | 'replying' | 'finished' | 'offline';

interface ListeningOrbProps {
  mode: OrbMode;
  micLevel?: number;
  agentLevel?: number;
  size?: number;
}

const LILAC = '#9a82c4';
const LILAC_LIGHT = '#b8a6da';
const MUTED = 'var(--color-ink-3)';            // offline: follows the theme

function blob(r: number, amp: number, k: number, phase: number, points = 72): string {
  let d = '';
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 + amp * Math.sin(k * a + phase));
    d += `${i ? 'L' : 'M'}${(rr * Math.cos(a)).toFixed(2)} ${(rr * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

interface Target {
  base: number;       // core radius
  breathe: number;    // breathing depth, fraction of base
  period: number;     // seconds per breath
  ringWave: number;   // outer ring deformation
  ringSpeed: number;  // radians per second
  coreWave: number;   // core deformation
}

function targetFor(mode: OrbMode, mic: number, agent: number): Target {
  const m = Math.min(1, mic / 140);
  const a = Math.min(1, agent / 120);
  switch (mode) {
    case 'connecting':
      return { base: 44, breathe: 0.04, period: 2.6, ringWave: 0.02, ringSpeed: 0.8, coreWave: 0 };
    case 'listening': {
      const speaking = m > 0.12;
      return {
        base: 50 + m * 12,
        breathe: speaking ? 0.015 : 0.06,
        period: 4.5,
        ringWave: speaking ? 0.02 + m * 0.05 : 0.01,
        ringSpeed: 2.2,
        coreWave: speaking ? 0.015 + m * 0.045 : 0,
      };
    }
    case 'thinking':
      return { base: 46, breathe: 0.03, period: 3.2, ringWave: 0.045, ringSpeed: 0.7, coreWave: 0.01 };
    case 'replying':
      return { base: 48 + a * 6, breathe: 0.02, period: 5, ringWave: 0.035 + a * 0.05, ringSpeed: 1.1, coreWave: 0.008 + a * 0.02 };
    case 'finished':
      return { base: 38, breathe: 0, period: 6, ringWave: 0, ringSpeed: 0, coreWave: 0 };
    case 'offline':
      return { base: 36, breathe: 0, period: 6, ringWave: 0, ringSpeed: 0, coreWave: 0 };
    default:
      return { base: 40, breathe: 0.025, period: 7, ringWave: 0, ringSpeed: 0.4, coreWave: 0 };
  }
}

export const ListeningOrb: React.FC<ListeningOrbProps> = ({ mode, micLevel = 0, agentLevel = 0, size = 240 }) => {
  const reduced = usePrefersReducedMotion();
  const halo = useRef<SVGCircleElement>(null);
  const ring = useRef<SVGPathElement>(null);
  const core = useRef<SVGPathElement>(null);
  const shine = useRef<SVGCircleElement>(null);
  const live = useRef({ mode, mic: micLevel, agent: agentLevel });
  live.current = { mode, mic: micLevel, agent: agentLevel };
  const muted = mode === 'offline';

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const cur: Target = targetFor(live.current.mode, 0, 0);
    let phase = 0;
    let last = performance.now();
    const start = last;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const goal = targetFor(live.current.mode, live.current.mic, live.current.agent);
      // Ease every parameter towards its goal: nothing jumps, even on a spike.
      const k = 1 - Math.pow(0.001, dt);            // ~frame-rate independent
      (Object.keys(goal) as (keyof Target)[]).forEach((key) => {
        cur[key] += (goal[key] - cur[key]) * k * (key === 'base' ? 0.9 : 0.6);
      });
      phase += cur.ringSpeed * dt;

      const breath = 1 + cur.breathe * Math.sin((t / cur.period) * Math.PI * 2);
      const r = cur.base * breath;
      halo.current?.setAttribute('r', (r * 1.62).toFixed(2));
      ring.current?.setAttribute('d', blob(r * 1.28, cur.ringWave, 3, phase));
      core.current?.setAttribute('d', blob(r, cur.coreWave, 5, -phase * 1.6));
      shine.current?.setAttribute('r', (r * 0.42).toFixed(2));
      shine.current?.setAttribute('cx', (-r * 0.28).toFixed(2));
      shine.current?.setAttribute('cy', (-r * 0.3).toFixed(2));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  // Reduced motion: a still orb whose size alone says what's happening.
  const still = targetFor(mode, micLevel, agentLevel).base;

  return (
    <svg
      viewBox="-100 -100 200 200"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className="block max-w-full h-auto"
    >
      <circle ref={halo} r={still * 1.62} style={{ fill: muted ? MUTED : LILAC }} opacity={0.1} />
      <path ref={ring} d={blob(still * 1.28, 0, 3, 0)} style={{ fill: muted ? MUTED : LILAC }} opacity={0.24} />
      <path ref={core} d={blob(still, 0, 5, 0)} style={{ fill: muted ? MUTED : LILAC }} />
      <circle ref={shine} r={still * 0.42} cx={-still * 0.28} cy={-still * 0.3} style={{ fill: muted ? 'var(--color-soft)' : LILAC_LIGHT }} opacity={0.55} />
    </svg>
  );
};
