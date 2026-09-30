import React from 'react';
import { ArrowLeft, Check, CloudOff, Info, LucideIcon } from 'lucide-react';
import { Accent, accentStyle } from './accents';
import { useT } from '../../i18n/LanguageProvider';

// ---------------------------------------------------------------- type

/** The occasional emotional line, in Fraunces italic. Use sparingly. */
export const Serif: React.FC<{ as?: 'p' | 'span' | 'h1' | 'h2'; className?: string; children: React.ReactNode }> = ({
  as: Tag = 'p',
  className = '',
  children,
}) => <Tag className={`font-serif italic font-light tracking-[-0.01em] text-balance ${className}`}>{children}</Tag>;

/** Small lowercase label above a group. */
export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ children, className = '', id }) => (
  <h2 id={id} className={`text-[13px] font-semibold tracking-[0.04em] text-ink-2 lowercase ${className}`}>{children}</h2>
);

// ---------------------------------------------------------------- screen scaffolding

/** Sub-screens: a back button and a title. Tabs don't need one. */
export const ScreenHeader: React.FC<{ title: string; onBack: () => void; right?: React.ReactNode; accent?: Accent }> = ({
  title,
  onBack,
  right,
}) => {
  const t = useT();
  return (
    <div className="flex items-center gap-3 min-h-12 settle">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('common.back')}
        className="tactile-quiet w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-full border border-line bg-surface text-ink"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden />
      </button>
      <h1 className="flex-1 min-w-0 text-[20px] font-semibold tracking-[-0.01em] break-soft">{title}</h1>
      {right}
    </div>
  );
};

/** A screen's stack of blocks, each settling in a beat after the last. */
export const Stack: React.FC<{ children: React.ReactNode; className?: string; gap?: string }> = ({
  children,
  className = '',
  gap = 'gap-4',
}) => (
  <div className={`flex flex-col ${gap} ${className}`}>
    {React.Children.toArray(children)
      .filter(Boolean)
      .map((child, i) => (
        <div key={i} className="settle" style={{ ['--i' as string]: i }}>
          {child}
        </div>
      ))}
  </div>
);

// ---------------------------------------------------------------- choices

/** One chunky option in a single-choice group (moods, answers). */
export const Choice: React.FC<{
  selected: boolean;
  onSelect: () => void;
  accent?: Accent;
  children: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  disabled?: boolean;
}> = ({ selected, onSelect, accent = 'sun' as Accent, children, hint, icon: Icon, disabled }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    onClick={onSelect}
    style={accentStyle(accent)}
    className={`w-full min-h-14 px-5 py-3 rounded-tile border text-left flex items-center gap-3 text-[17px] font-medium disabled:opacity-45 ${
      selected
        ? 'tactile bg-(--accent) text-on-accent border-transparent'
        : 'tactile-quiet bg-surface text-ink border-line'
    }`}
  >
    {Icon && <Icon className="w-5 h-5 shrink-0" aria-hidden />}
    <span className="flex-1 min-w-0 flex flex-col break-soft">
      <span>{children}</span>
      {hint && <span className={`text-sm ${selected ? 'text-on-accent/75' : 'text-ink-2'}`}>{hint}</span>}
    </span>
    {selected && <Check className="w-5 h-5 shrink-0" aria-hidden />}
  </button>
);

export const ChoiceGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = 'flex flex-col gap-2.5',
}) => (
  <div role="radiogroup" aria-label={label} className={className}>
    {children}
  </div>
);

// ---------------------------------------------------------------- progress

export const ProgressIndicator: React.FC<{ current: number; total: number; accent?: Accent; label: string }> = ({
  current,
  total,
  accent = 'sun' as Accent,
  label,
}) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={1}
    aria-valuemax={total}
    aria-valuenow={current}
    style={accentStyle(accent)}
    className="flex items-center gap-1.5 w-full"
  >
    {Array.from({ length: total }, (_, i) => (
      <span
        key={i}
        className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ease-soft ${i < current ? 'bg-(--accent)' : 'bg-line-strong'}`}
      />
    ))}
  </div>
);

// ---------------------------------------------------------------- states

export const EmptyState: React.FC<{
  art?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ art, title, hint, action, className = '' }) => (
  <div className={`flex flex-col items-center text-center gap-3 px-4 py-6 ${className}`}>
    {art && <div className="w-full max-w-[260px] mb-2" aria-hidden>{art}</div>}
    <p className="text-[19px] font-semibold text-ink break-soft">{title}</p>
    {hint && <p className="text-[15px] text-ink-2 max-w-[34ch] break-soft">{hint}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/** A calm, inline message. Errors are said plainly, not in alarm red. */
export const Notice: React.FC<{ tone?: 'info' | 'error' | 'offline'; children: React.ReactNode; action?: React.ReactNode }> = ({
  tone = 'info',
  children,
  action,
}) => {
  const Icon = tone === 'offline' ? CloudOff : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="rounded-tile bg-raised border border-line px-4 py-3 flex items-start gap-3 text-[15px] text-ink"
    >
      <Icon className="w-5 h-5 mt-0.5 shrink-0 text-ink-2" aria-hidden />
      <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
        <div className="break-soft">{children}</div>
        {action && <div className="-ml-2 -mb-2">{action}</div>}
      </div>
    </div>
  );
};

/** A quiet loading placeholder the shape of what's coming. */
export const Placeholder: React.FC<{ className?: string }> = ({ className = 'h-20' }) => (
  <div aria-hidden className={`hush rounded-card bg-surface border border-line ${className}`} />
);

/** Frames an illustration on a field of colour (or none). Always decorative. */
export const IllustrationPanel: React.FC<{ accent?: Accent; children: React.ReactNode; className?: string }> = ({
  accent,
  children,
  className = '',
}) => (
  <figure
    aria-hidden
    style={accent ? accentStyle(accent) : undefined}
    className={`m-0 overflow-hidden rounded-card ${accent ? 'bg-(--accent)' : ''} ${className}`}
  >
    {children}
  </figure>
);

/** Serif sentences, one per line: how Wellbeing talks back. */
export const ReflectionCard: React.FC<{ lines: string[]; closing?: string; footnote?: string }> = ({ lines, closing, footnote }) => (
  <section className="rounded-card bg-surface border border-line px-6 py-7 flex flex-col gap-5">
    {lines.map((line, i) => (
      <Serif key={i} className="text-[24px] leading-[1.3] text-ink break-soft">
        {line}
      </Serif>
    ))}
    {closing && <p className="text-[17px] font-semibold text-ink">{closing}</p>}
    {footnote && <p className="text-sm text-ink-2">{footnote}</p>}
  </section>
);
