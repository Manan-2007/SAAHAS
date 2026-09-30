import React, { useId, useState } from 'react';
import { Eye, EyeOff, Moon, Smartphone, Sun } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { LANGUAGES } from '../../i18n/strings';
import { ThemePreference, useTheme } from '../../theme';
import { Accent, accentStyle } from './accents';

/**
 * One consent, said plainly, with a real switch. Big enough to read, big
 * enough to tap - consent is never small print.
 */
export const ConsentCard: React.FC<{
  title: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  required?: boolean;
  requiredLabel?: string;
  disabled?: boolean;
  disabledHint?: string;
  accent?: Accent;
}> = ({ title, hint, on, onToggle, required, requiredLabel = 'needed for an account', disabled, disabledHint, accent = 'sage' as Accent }) => {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-describedby={`${id}-hint`}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onToggle()}
      style={accentStyle(accent)}
      className={`tactile-quiet w-full rounded-card border p-4 text-left flex items-start gap-4 ${
        on ? 'bg-raised border-line-strong' : 'bg-surface border-line'
      } ${disabled ? 'opacity-55' : ''}`}
    >
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[16px] font-semibold text-ink break-soft">{title}</span>
        {required && <span className="-mt-0.5 text-[13px] font-semibold text-ink-2">{requiredLabel}</span>}
        <span id={`${id}-hint`} className="text-sm text-ink-2 break-soft">
          {disabled && disabledHint ? disabledHint : hint}
        </span>
      </span>
      <span
        aria-hidden
        className={`mt-0.5 w-12 h-7 shrink-0 rounded-full p-1 transition-colors duration-300 ease-soft ${on ? 'bg-(--accent)' : 'bg-line-strong'}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-ink transition-transform duration-300 ease-soft ${on ? 'translate-x-5 bg-on-accent' : ''}`}
        />
      </span>
    </button>
  );
};

/** English, हिन्दी, ਪੰਜਾਬੀ - each written in itself, so anyone can find theirs. */
export const LanguageSwitcher: React.FC<{
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
  label: string;
  disabled?: boolean;
}> = ({ value, onChange, label, disabled }) => (
  <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
    {LANGUAGES.map((l) => {
      const on = l.code === value;
      return (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={on}
          lang={l.code}
          disabled={disabled}
          onClick={() => onChange(l.code)}
          className={`min-h-14 px-2 rounded-tile border text-[17px] font-semibold break-soft disabled:opacity-50 ${
            on ? 'tactile bg-ink text-canvas border-transparent' : 'tactile-quiet bg-surface text-ink border-line'
          }`}
        >
          {l.label}
        </button>
      );
    })}
  </div>
);

/** Match my phone / Light / Dark. */
export const ThemeSwitcher: React.FC<{ label: string; labels: Record<ThemePreference, string> }> = ({ label, labels }) => {
  const { preference, setPreference } = useTheme();
  const options: { id: ThemePreference; icon: React.ElementType }[] = [
    { id: 'system', icon: Smartphone },
    { id: 'light', icon: Sun },
    { id: 'dark', icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {options.map(({ id, icon: Icon }) => {
        const on = preference === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setPreference(id)}
            className={`min-h-16 px-2 py-2 rounded-tile border flex flex-col items-center justify-center gap-1 text-[14px] font-semibold break-soft ${
              on ? 'tactile bg-ink text-canvas border-transparent' : 'tactile-quiet bg-surface text-ink border-line'
            }`}
          >
            <Icon className="w-5 h-5" aria-hidden />
            {labels[id]}
          </button>
        );
      })}
    </div>
  );
};

const FIELD =
  'w-full min-h-14 rounded-tile bg-surface border border-line px-4 text-[17px] text-ink placeholder:text-ink-3 outline-none transition-colors duration-200 focus:border-ink-2 focus:bg-raised';

export const TextField: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; optionalLabel?: string }
> = ({ label, hint, optionalLabel, id, type, className = '', ...rest }) => {
  const auto = useId();
  const fieldId = id ?? auto;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={fieldId} className="text-[15px] font-semibold text-ink">
        {label}
        {optionalLabel && <span className="ml-1.5 font-normal text-ink-2">{optionalLabel}</span>}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type={isPassword && reveal ? 'text' : type}
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          className={`${FIELD} ${isPassword ? 'pr-14' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-12 h-12 inline-flex items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            {reveal ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${fieldId}-hint`} className="text-sm text-ink-2 break-soft">
          {hint}
        </p>
      )}
    </div>
  );
};

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({
  label,
  id,
  className = '',
  ...rest
}) => {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={fieldId} className="text-[15px] font-semibold text-ink">
        {label}
      </label>
      <textarea id={fieldId} className={`${FIELD} py-3 resize-none leading-relaxed`} {...rest} />
    </div>
  );
};
