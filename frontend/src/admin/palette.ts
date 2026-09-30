// Colours for inline styles and SVG in the Command Centre, read from the same
// CSS variables as the Tailwind tokens (src/index.css), so there is one palette.
// Status colours (danger / warn / ok / info) are counsellor-side only.

const v = (name: string) => `var(--color-${name})`;
const tint = (name: string, pct: number) => `color-mix(in srgb, var(--color-${name}) ${pct}%, transparent)`;

export interface Tone {
  color: string;
  bg: string;
}

export const TONE = {
  neutral: { color: v('ink-2'), bg: v('raised') },
  quiet: { color: v('ink'), bg: v('raised') },
  low: { color: v('sun-ink'), bg: tint('sun', 14) },
  warn: { color: v('warn'), bg: tint('warn', 16) },
  danger: { color: v('danger'), bg: tint('danger', 16) },
  ok: { color: v('ok'), bg: tint('ok', 16) },
  info: { color: v('info'), bg: tint('info', 16) },
} satisfies Record<string, Tone>;

export const CHART = {
  grid: 'var(--chart-grid)',
  score: v('sun-ink'),
  forecast: v('warn'),
  crisis: v('danger'),
  text: v('info'),
  voice: v('lilac'),
  tick: v('ink-2'),
  levels: [v('ink-3'), v('sun-ink'), v('warn'), v('danger')] as const,
};

export const INK = { strong: v('ink'), muted: v('ink-2') };
