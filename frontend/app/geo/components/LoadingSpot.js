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

export default function LoadingSpot({ roundNumber, appleAttempt, appleTotal, leaving = false }) {
  const [slow, setSlow] = useState(false);

  // The caller gives this a key per round and per retry, so mounting is
  // the start of the stretch being timed.
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  // "of 12" was a promise the code does not keep: findLookAround stops at
  // FIND_BUDGET_MS, and at the first spot that never answers, so a player
  // watching "spot 2 of 12" could be told there was far more runway left
  // than there was. The count of what has been tried is true and is the
  // part that shows something is happening.
  const message = appleTotal
    ? `Trying spot ${(appleAttempt || 0) + 1}`
    : 'Picking a street';

  return (
    <div className={`absolute inset-0 z-40 flex flex-col items-center justify-center bg-pe-canvas/95 px-6 text-center ${leaving ? 'pe-fade-out' : 'pe-fade-in'}`} role={leaving ? undefined : 'status'} aria-live="polite" aria-hidden={leaving || undefined}>
      <Loader2 className="h-10 w-10 animate-spin text-pe-accent-fg" />
      <p className="mt-5 text-lg font-semibold text-pe-fg">Round {roundNumber}</p>
      <p className="mt-1 text-sm text-pe-muted">{message}</p>
      {slow ? (
        <>
          {/* A slow connection is the usual reason now: a spot is waited
              for while Apple keeps sending it data, and on a slow link
              that measured 26 to 41 seconds (lib/lookAround.js). */}
          <p className="mt-4 max-w-xs text-sm text-pe-muted">Still loading. Street imagery can take a while on a slow connection.</p>
          <Link href="/geo" className="ui-btn ui-btn--secondary mt-4">
            <ArrowLeft className="h-4 w-4" />
            Back to the start
          </Link>
        </>
      ) : null}
    </div>
  );
}
