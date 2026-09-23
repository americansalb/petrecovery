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
 */

import { useCallback, useState } from 'react';
import RecoveryKit from '@/app/components/report/recoveryKit/RecoveryKit';

export default function RecoveryKitPanel({ caseNumber, petName, onEmptyChange }) {
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
  const handleEmptyChange = useCallback(
    (empty) => {
      setIsEmpty(empty);
      if (onEmptyChange) onEmptyChange(empty);
    },
    [onEmptyChange]
  );

  if (!caseNumber) return null;

  return (
    <div
      id="share-kit"
      className={
        isEmpty
          ? 'scroll-mt-24'
          : 'scroll-mt-24 rounded-2xl bg-white p-5 ring-1 ring-midnight-200 sm:p-6'
      }
    >
      <RecoveryKit
        caseNumber={caseNumber}
        mode="share"
        petName={petName}
        initialStatus="COMPLETE"
        onEmptyChange={handleEmptyChange}
      />
    </div>
  );
}
