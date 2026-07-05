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

export function Modal({ open = true, onClose, title, subtitle, children, maxWidth = 'max-w-md', variant = 'default' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // The paper variant is a loose sheet laid over the desk: cream, ink
  // serif title, square-ish corners — the Paper Passport world's dialog.
  const paper = variant === 'paper';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className={cn('absolute inset-0 backdrop-blur-sm', paper ? 'bg-pen-900/40' : 'bg-black/50')} onClick={onClose} aria-hidden="true" />
      {paper ? (
        <div className={cn('relative w-full p-6 bg-paper-50 border border-paper-400 rounded-t-lg rounded-b-none sm:rounded-lg shadow-[0_18px_50px_rgba(35,42,61,0.45)] max-h-[90vh] overflow-y-auto animate-slide-up', maxWidth)}>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-pen-400 hover:text-pen-900 transition-colors">
              <X size={20} />
            </button>
          )}
          {title && <h3 className="font-diary italic text-[21px] text-pen-900 mb-1 pr-8">{title}</h3>}
          {subtitle && <p className="text-sm text-pen-400 mb-4">{subtitle}</p>}
          {children}
        </div>
      ) : (
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
      )}
    </div>
  );
}

/** A ready-made destructive confirm on top of Modal. */
export function ConfirmModal({ open = true, onClose, title, body, confirmLabel = 'Delete', busy, onConfirm, variant = 'default' }) {
  const paper = variant === 'paper';
  return (
    <Modal open={open} onClose={onClose} title={title} variant={variant}>
      <p className={cn('mb-6', paper ? 'text-pen-600 font-diary italic text-[14px]' : 'text-midnight-600')}>{body}</p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className={cn(
            'flex-1 px-4 py-2.5 transition-colors',
            paper
              ? 'rounded-[5px] border border-pen-300 text-pen-600 font-stamp text-[10.5px] uppercase tracking-[0.12em] hover:border-pen-900 hover:text-pen-900'
              : 'rounded-xl border-2 border-midnight-200 text-midnight-600 font-bold hover:border-midnight-300 hover:text-midnight-900'
          )}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            'flex-1 px-4 py-2.5 transition-colors disabled:opacity-60',
            paper
              ? 'rounded-[5px] bg-stampred hover:bg-stampred-dark text-paper-50 font-stamp text-[10.5px] uppercase tracking-[0.12em]'
              : 'rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold'
          )}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
