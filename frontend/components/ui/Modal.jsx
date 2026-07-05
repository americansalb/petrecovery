'use client';

/**
 * Modal - the one dialog primitive.
 *
 * Bottom sheet on phones, centered card on larger screens; backdrop
 * click and the corner X both close. `variant` is accepted for
 * backwards compatibility but every dialog renders the same plain way.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

export function Modal({ open = true, onClose, title, subtitle, children, maxWidth = 'max-w-md', variant }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className={cn('relative w-full p-6 bg-white rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto animate-slide-up', maxWidth)}>
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
