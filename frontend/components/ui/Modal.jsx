'use client';

/**
 * Modal - the one dialog primitive.
 *
 * Bottom sheet on phones, centered card on larger screens; backdrop
 * click and the corner X both close. `variant` is accepted for
 * backwards compatibility but every dialog renders the same plain way.
 *
 * Layering: z-[60], deliberately above the mobile GlobalBottomNav (z-50)
 * — a bottom sheet whose primary button hides behind the tab bar is a
 * dead end on every phone.
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open = true, onClose, title, subtitle, children, maxWidth = 'max-w-md', variant }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // Move focus into the dialog and keep Tab inside it; hand focus back
    // to the opener on close so keyboard users don't land at the top of
    // the page behind a dialog they can no longer see.
    const opener = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = [...panelRef.current.querySelectorAll(FOCUSABLE)]
        .filter((el) => el.offsetParent !== null);
      if (!focusables.length) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (!inside) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn('relative w-full p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6 bg-white rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto animate-slide-up outline-none', maxWidth)}
      >
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 transition-colors">
            <X size={20} />
          </button>
        )}
        {title && <h3 className="text-lg font-semibold text-neutral-900 mb-1 pr-8">{title}</h3>}
        {subtitle && <p className="text-sm text-neutral-500 mb-4">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

/** A ready-made destructive confirm on top of Modal. */
export function ConfirmModal({ open = true, onClose, title, body, confirmLabel = 'Delete', busy, onConfirm, variant }) {
  return (
    <Modal open={open} onClose={onClose} title={title} variant={variant}>
      <p className="mb-6 text-[15px] text-neutral-600">{body}</p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 hover:border-neutral-900 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
