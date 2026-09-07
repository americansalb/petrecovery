'use client';

/**
 * Between rounds: what the server is doing, in plain words, with a
 * counter for Apple attempts.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const GOOGLE_STEPS = [
  'Picking a random point on Earth',
  'Checking whether it is land',
  'Asking Street View for imagery nearby',
  'Trying more points',
];

export default function LoadingSpot({ provider, roundNumber, appleAttempt, appleTotal }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(GOOGLE_STEPS.length - 1, s + 1)), 1400);
    return () => clearInterval(id);
  }, [roundNumber]);

  const message =
    provider === 'apple'
      ? appleTotal
        ? `Trying spot ${Math.min(appleTotal, (appleAttempt || 0) + 1)} of ${appleTotal} for Look Around imagery`
        : 'Picking random city streets'
      : GOOGLE_STEPS[step];

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-midnight-950/95 text-center" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 animate-spin text-flash-400" />
      <p className="mt-5 text-lg font-semibold text-white">Round {roundNumber}</p>
      <p className="mt-1 text-sm text-white/70">{message}</p>
    </div>
  );
}
