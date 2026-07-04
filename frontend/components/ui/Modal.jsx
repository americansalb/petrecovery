'use client';

/**
 * Modal - the one dialog primitive.
 *
 * Bottom sheet on phones, centered card on larger screens; backdrop
 * click and the corner X both close. Replaces the hand-rolled
 * fixed-inset overlays that each page used to carry.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';
import { Card } from './Card';

export function Modal({ open = true, onClose, title, subtitle, children, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <Card className={cn('relative w-full p-6 rounded-t-3xl rounded-b-none sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-slide-up', maxWidth)}>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600 transition-colors">
            <X size={20} />
          </button>
        )}
        {title && <h3 className="text-xl font-bold text-midnight-900 mb-1 pr-8">{title}</h3>}
        {subtitle && <p className="text-sm text-midnight-500 mb-4">{subtitle}</p>}
        {children}
      </Card>
    </div>
  );
}

/** A ready-made destructive confirm on top of Modal. */
export function ConfirmModal({ open = true, onClose, title, body, confirmLabel = 'Delete', busy, onConfirm }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-midnight-600 mb-6">{body}</p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-midnight-200 text-midnight-600 font-bold hover:border-midnight-300 hover:text-midnight-900 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors disabled:opacity-60"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
