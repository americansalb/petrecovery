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

import { motion } from 'framer-motion';
import RecoveryKit from '@/app/components/report/recoveryKit/RecoveryKit';

export default function RecoveryKitPanel({ caseNumber, petName }) {
  if (!caseNumber) return null;

  return (
    <motion.div
      id="share-kit"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="scroll-mt-20 rounded-2xl border border-midnight-200 bg-white p-5 sm:p-6 shadow-sm"
    >
      <RecoveryKit caseNumber={caseNumber} mode="share" petName={petName} initialStatus="COMPLETE" />
    </motion.div>
  );
}
