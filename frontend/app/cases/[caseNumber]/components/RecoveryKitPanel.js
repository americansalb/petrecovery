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
 */

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import RecoveryKit from '@/app/components/report/recoveryKit/RecoveryKit';

export default function RecoveryKitPanel({ caseNumber, petName }) {
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
  const handleEmptyChange = useCallback((empty) => setIsEmpty(empty), []);

  if (!caseNumber) return null;

  return (
    <motion.div
      id="share-kit"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={
        isEmpty
          ? 'scroll-mt-20'
          : 'scroll-mt-20 rounded-2xl border border-midnight-200 bg-white p-5 sm:p-6 shadow-sm'
      }
    >
      <RecoveryKit
        caseNumber={caseNumber}
        mode="share"
        petName={petName}
        initialStatus="COMPLETE"
        onEmptyChange={handleEmptyChange}
      />
    </motion.div>
  );
}
