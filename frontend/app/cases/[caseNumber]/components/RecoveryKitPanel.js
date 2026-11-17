'use client';

/**
 * RecoveryKitPanel - the permanent "share kit" surface on the public case page.
 *
 * Renders the durable Recovery Kit in share mode: the scannable QR, the
 * printable branded flyers, and the ready-to-post social images + captions the
 * cascade generated at report time. Reads the same PII-safe /recovery-kit
 * endpoint as the success screen, so any neighbor who lands on the case can
 * grab a flyer and spread the word. Renders nothing for older cases with no
 * activation (RecoveryKit returns the null fallback).
 *
 * `onEmptyChange` tells the page whether there is a kit, so its "Print a
 * flyer" row can point here only when there is something to print.
 *
 * `folded` is the phone's version: one closed row, "Flyers to print and
 * share", that opens the kit. A link to #share-kit opens it too.
 */

import { useCallback, useEffect, useId, useState } from 'react';
import { ChevronDown, Printer } from 'lucide-react';
import RecoveryKit from '@/app/components/report/recoveryKit/RecoveryKit';

export default function RecoveryKitPanel({ caseNumber, petName, onEmptyChange, folded = false }) {
  // The wrapper paints a border, a background and padding. When the kit had
  // nothing to show, RecoveryKit returned null and this drew an empty white
  // card on the public case page - verified against
  // /api/cases/AUS-2026-0001/recovery-kit returning {"exists":false}.
  //
  // RecoveryKit reports emptiness now, and the decoration goes with it. The
  // wrapper itself must stay mounted: unmounting it on the first "empty"
  // report - which is what an unloaded kit reports - would destroy the very
  // child whose later report would bring it back, and the kit would never
  // appear at all. So the element stays and loses its card styling, which
  // leaves nothing visible around a child rendering null.
  const [isEmpty, setIsEmpty] = useState(true);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const handleEmptyChange = useCallback(
    (empty) => {
      setIsEmpty(empty);
      if (onEmptyChange) onEmptyChange(empty);
    },
    [onEmptyChange]
  );

  useEffect(() => {
    if (!folded) return undefined;
    const openOnLink = () => {
      if (window.location.hash === '#share-kit') setOpen(true);
    };
    openOnLink();
    window.addEventListener('hashchange', openOnLink);
    return () => window.removeEventListener('hashchange', openOnLink);
  }, [folded]);

  if (!caseNumber) return null;

  const kit = (
    <RecoveryKit
      caseNumber={caseNumber}
      petName={petName}
      initialStatus="COMPLETE"
      onEmptyChange={handleEmptyChange}
    />
  );

  if (folded) {
    // Hidden, not unmounted, while there is no kit: the same reason as above.
    return (
      <section id="share-kit" aria-label="Flyers to print and share" hidden={isEmpty} className="scroll-mt-20 rounded-2xl bg-white ring-1 ring-midnight-200">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left text-lg font-semibold text-midnight-900"
        >
          <Printer size={20} className="shrink-0 text-midnight-600" aria-hidden="true" />
          <span className="min-w-0 flex-1">Flyers to print and share</span>
          <ChevronDown size={20} className={`shrink-0 text-midnight-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div id={bodyId} hidden={!open} className="border-t border-midnight-100 p-4">
          {kit}
        </div>
      </section>
    );
  }

  return (
    <div
      id="share-kit"
      className={
        isEmpty
          ? 'scroll-mt-24'
          : 'scroll-mt-24 rounded-2xl bg-white p-5 ring-1 ring-midnight-200 sm:p-6'
      }
    >
      {kit}
    </div>
  );
}
