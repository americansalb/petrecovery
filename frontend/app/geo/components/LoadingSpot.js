'use client';

/**
 * Between rounds: what is happening, in plain words, and a way out.
 *
 * A round is a list of places the browser tries in turn until Look
 * Around opens at one (app/geo/lib/lookAround.js), so the honest thing
 * to show is which one it is on.
 *
 * The way out is not decoration. Measured against an imagery service
 * that accepts a connection and then says nothing, this screen used to
 * sit there for five and a half minutes - twelve spots at the old nine
 * second timeout, three times over - with no control on it at all. The
 * search is bounded now, but a player who has been watching a spinner
 * for eight seconds should never have to trust that.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SLOW_AFTER_MS } from '../lib/lookAround';

export default function LoadingSpot({ roundNumber, appleAttempt, appleTotal }) {
  const [slow, setSlow] = useState(false);

  // The caller gives this a key per round and per retry, so mounting is
  // the start of the stretch being timed.
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  // "of 12" was a promise the code does not keep: findLookAround stops at
  // FIND_BUDGET_MS, which at four seconds a spot is about five of them,
  // so a player watching "spot 2 of 12" was told there was far more
  // runway left than there was. The count of what has been tried is true
  // and is the part that shows something is happening.
  const message = appleTotal
    ? `Trying spot ${(appleAttempt || 0) + 1}`
    : 'Picking a street';

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ocean-950/95 px-6 text-center" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 animate-spin text-clay-300" />
      <p className="mt-5 text-lg font-semibold text-white">Round {roundNumber}</p>
      <p className="mt-1 text-sm text-white/70">{message}</p>
      {slow ? (
        <>
          <p className="mt-4 max-w-xs text-sm text-white/60">This is taking longer than it should.</p>
          <Link
            href="/geo"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Probably Earth
          </Link>
        </>
      ) : null}
    </div>
  );
}
