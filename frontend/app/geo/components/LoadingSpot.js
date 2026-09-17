'use client';

/**
 * Between rounds: what is happening, in plain words.
 *
 * A round is a list of places the browser tries in turn until Look
 * Around opens at one (app/geo/lib/lookAround.js), so the honest thing
 * to show is which one it is on. It used to cycle four invented steps
 * about probing Street View, which described the server's old Google
 * work and, once that went, described nothing at all.
 */

import { Loader2 } from 'lucide-react';

export default function LoadingSpot({ roundNumber, appleAttempt, appleTotal }) {
  const message = appleTotal
    ? `Trying spot ${Math.min(appleTotal, (appleAttempt || 0) + 1)} of ${appleTotal}`
    : 'Picking a street';

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ocean-950/95 text-center" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 animate-spin text-clay-300" />
      <p className="mt-5 text-lg font-semibold text-white">Round {roundNumber}</p>
      <p className="mt-1 text-sm text-white/70">{message}</p>
    </div>
  );
}
