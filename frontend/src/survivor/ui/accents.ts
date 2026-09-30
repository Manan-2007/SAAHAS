import type { CSSProperties } from 'react';

// Colour belongs to an experience, never to a status. A component takes an
// accent and exposes it to its children as --accent, so classes like
// bg-(--accent) and text-(--accent) stay static for Tailwind.

export type Accent = 'sun' | 'iris' | 'lilac' | 'sage' | 'coral' | 'rose';

export const EXPERIENCE = {
  checkin: 'sun',
  chat: 'iris',
  voice: 'lilac',
  breathe: 'sage',
  support: 'coral',
  upcoming: 'rose',
} as const satisfies Record<string, Accent>;

export const ACCENT_HEX: Record<Accent, string> = {
  sun: '#f4c95d',
  iris: '#6f8fe8',
  lilac: '#9a82c4',
  sage: '#7dba83',
  coral: '#ef765a',
  rose: '#e58aae',
};

export const accentStyle = (accent: Accent, extra?: CSSProperties): CSSProperties =>
  ({ '--accent': ACCENT_HEX[accent], ...extra }) as CSSProperties;
