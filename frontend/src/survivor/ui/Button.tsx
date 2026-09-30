import React from 'react';
import { Loader2, LucideIcon } from 'lucide-react';
import { Accent, accentStyle } from './accents';

type Variant = 'accent' | 'solid' | 'quiet' | 'ghost';

interface BaseProps {
  variant?: Variant;
  accent?: Accent;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  full?: boolean;
  busy?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type ButtonProps = BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = BaseProps & React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const VARIANT: Record<Variant, string> = {
  // A coloured object: the accent says which experience this belongs to.
  accent: 'tactile bg-(--accent) text-on-accent font-semibold',
  // The quiet primary: cream on dark.
  solid: 'tactile bg-ink text-canvas font-semibold',
  quiet: 'tactile-quiet bg-surface text-ink border border-line font-semibold',
  ghost: 'text-ink-2 hover:text-ink font-medium underline-offset-4 hover:underline',
};

const SIZE = {
  md: 'min-h-12 px-5 text-[15px] gap-2',
  lg: 'min-h-14 px-6 text-base gap-2.5',
};

/** Buttons are objects: boxy, a lip at the bottom, never a pill. 48px minimum. */
export const Button: React.FC<ButtonProps | LinkProps> = ({
  variant = 'solid',
  accent = 'sun' as Accent,
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  full,
  busy,
  className = '',
  children,
  ...rest
}) => {
  const cls = [
    'inline-flex items-center justify-center rounded-tile select-none text-center leading-tight',
    'disabled:opacity-45 disabled:pointer-events-none aria-disabled:opacity-45',
    VARIANT[variant],
    variant === 'ghost' ? 'min-h-12 px-2 text-[15px] gap-2' : SIZE[size],
    full ? 'w-full' : '',
    className,
  ].join(' ');

  const content = (
    <>
      {busy ? <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden /> : Icon && <Icon className="w-5 h-5 shrink-0" aria-hidden />}
      {children && <span className="break-soft">{children}</span>}
      {IconRight && !busy && <IconRight className="w-5 h-5 shrink-0" aria-hidden />}
    </>
  );

  if ('href' in rest && rest.href !== undefined) {
    const { href, ...anchor } = rest as LinkProps;
    return (
      <a href={href} className={cls} style={accentStyle(accent)} {...anchor}>
        {content}
      </a>
    );
  }
  const button = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type="button"
      className={cls}
      style={accentStyle(accent)}
      aria-busy={busy || undefined}
      {...button}
      disabled={button.disabled || busy}
    >
      {content}
    </button>
  );
};

/** A 48px round icon button with a required label, for toolbars. */
export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; pressed?: boolean }
> = ({ icon: Icon, label, pressed, className = '', ...rest }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    className={`tactile-quiet w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink aria-pressed:bg-ink aria-pressed:text-canvas disabled:opacity-45 ${className}`}
    {...rest}
  >
    <Icon className="w-5 h-5" aria-hidden />
  </button>
);
