import React from 'react';
import { ArrowRight, ChevronRight, LucideIcon } from 'lucide-react';
import { Accent, accentStyle } from './accents';

interface ActionCardProps {
  accent: Accent;
  title: string;
  hint?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  /**
   * hero: a whole coloured object with room for an illustration.
   * tile: half-width, a coloured key on a dark card.
   * row:  full-width doorway with a chevron.
   */
  variant?: 'hero' | 'tile' | 'row';
  /** hero: the call to action under the title */
  cta?: string;
  /** hero: an illustration, drawn to the right or above */
  art?: React.ReactNode;
  /** row: something small on the right instead of the chevron */
  trailing?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** The coloured key in tiles and rows. */
export const AccentKey: React.FC<{ icon: LucideIcon; size?: 'md' | 'lg' }> = ({ icon: Icon, size = 'md' }) => (
  <span
    aria-hidden
    className={`tactile shrink-0 inline-flex items-center justify-center bg-(--accent) text-on-accent ${
      size === 'lg' ? 'w-14 h-14 rounded-[16px]' : 'w-12 h-12 rounded-[13px]'
    }`}
  >
    <Icon className={size === 'lg' ? 'w-6 h-6' : 'w-[22px] h-[22px]'} strokeWidth={2.1} />
  </span>
);

export const ActionCard: React.FC<ActionCardProps> = ({
  accent,
  title,
  hint,
  icon,
  onClick,
  href,
  variant = 'row',
  cta,
  art,
  trailing,
  className = '',
  style,
}) => {
  const Tag = href ? 'a' : 'button';
  const common = {
    onClick,
    ...(href ? { href } : { type: 'button' as const }),
    style: accentStyle(accent, style),
  };

  if (variant === 'hero') {
    return (
      <Tag
        {...common}
        className={`tactile group relative w-full overflow-hidden rounded-card bg-(--accent) text-on-accent text-left flex flex-col ${className}`}
      >
        {art && <span className="block px-5 pt-5" aria-hidden>{art}</span>}
        <span className="flex flex-col gap-1 px-6 pb-6 pt-3">
          <span className="text-[26px] leading-[1.15] font-semibold tracking-[-0.01em] break-soft">{title}</span>
          {hint && <span className="text-[15px] text-on-accent/75 break-soft">{hint}</span>}
          {cta && (
            <span className="mt-4 self-end inline-flex items-center gap-2 min-h-12 px-5 rounded-tile bg-on-accent text-(--accent) font-semibold text-[15px] transition-transform duration-300 ease-soft group-hover:translate-x-0.5">
              {cta}
              <ArrowRight className="w-5 h-5" aria-hidden />
            </span>
          )}
        </span>
      </Tag>
    );
  }

  if (variant === 'tile') {
    return (
      <Tag
        {...common}
        className={`tactile-quiet w-full min-h-[132px] rounded-card bg-surface border border-line p-4 text-left flex flex-col justify-between gap-4 ${className}`}
      >
        {icon && <AccentKey icon={icon} />}
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[17px] font-semibold text-ink break-soft">{title}</span>
          {hint && <span className="text-sm text-ink-2 break-soft">{hint}</span>}
        </span>
      </Tag>
    );
  }

  return (
    <Tag
      {...common}
      className={`tactile-quiet w-full min-h-[72px] rounded-card bg-surface border border-line px-4 py-3.5 text-left flex items-center gap-4 ${className}`}
    >
      {icon && <AccentKey icon={icon} />}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[16px] font-semibold text-ink break-soft">{title}</span>
        {hint && <span className="text-sm text-ink-2 break-soft">{hint}</span>}
      </span>
      {trailing ?? <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" aria-hidden />}
    </Tag>
  );
};
