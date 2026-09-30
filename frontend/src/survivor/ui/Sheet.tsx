import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../../i18n/LanguageProvider';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A bottom sheet on phones, a centred panel on larger screens. Escape and the
 * backdrop close it; focus stays inside while it's open and goes back to
 * whatever opened it afterwards.
 */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  const t = useT();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items.length) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="sahaas fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ minHeight: 0, background: 'transparent' }}>
      <div className="absolute inset-0 bg-(--scrim) soft-fade" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-up relative w-full sm:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-sheet sm:rounded-sheet bg-surface border border-line px-5 pt-5 safe-bottom outline-none"
      >
        <div className="flex items-start gap-3 mb-4">
          <h2 id={titleId} className="flex-1 text-[20px] font-semibold tracking-[-0.01em] pt-2.5 break-soft">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="tactile-quiet w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-full border border-line bg-raised text-ink"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
};
