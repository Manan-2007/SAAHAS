import React from 'react';

/**
 * Every Command Centre page opens the same way: a plain title, one sentence
 * saying what the page is for, and at most a couple of actions on the right.
 * No icon badges, no pills - the content carries the colour.
 */
export const PageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1">
    <div className="min-w-0">
      <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em] text-ink">{title}</h1>
      {description && <p className="mt-1 text-[14px] text-ink-2 max-w-2xl leading-relaxed">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** A quiet secondary button used across the Command Centre. */
export const QuietButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }> = ({
  icon,
  children,
  className = '',
  ...rest
}) => (
  <button
    type="button"
    className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-line bg-surface text-ink text-[13px] font-semibold hover:bg-raised transition-colors disabled:opacity-50 ${className}`}
    {...rest}
  >
    {icon && <span className="material-symbols-outlined text-[18px] text-ink-2" aria-hidden>{icon}</span>}
    {children}
  </button>
);

/** The one filled button per area. */
export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }> = ({
  icon,
  children,
  className = '',
  ...rest
}) => (
  <button
    type="button"
    className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-ink text-canvas text-[13px] font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50 ${className}`}
    {...rest}
  >
    {icon && <span className="material-symbols-outlined text-[18px]" aria-hidden>{icon}</span>}
    {children}
  </button>
);
