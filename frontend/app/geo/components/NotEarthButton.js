'use client';

/**
 * The Not Earth button, which is on every round.
 *
 * About one casual round in two hundred is a NASA panorama taken on
 * Mars or the Moon (app/lib/geo/notEarth.js). This is how you call it.
 * Calling it right is full marks and the badge for that world. Calling
 * it on an ordinary round throws the round away, which is what stops
 * everyone pressing it every time and is why a round in the Atacama is
 * now a decision.
 *
 * Two taps, because one tap can cost you the round.
 */

import { useEffect, useRef, useState } from 'react';
import { Rocket } from 'lucide-react';

export default function NotEarthButton({ onCall, disabled = false, roundKey }) {
  const [asking, setAsking] = useState(false);
  const timerRef = useRef(null);

  // A new round starts closed, and an unanswered question closes itself
  // rather than sitting over the picture for the rest of the round.
  useEffect(() => setAsking(false), [roundKey]);
  useEffect(() => {
    if (!asking) return undefined;
    timerRef.current = setTimeout(() => setAsking(false), 6000);
    return () => clearTimeout(timerRef.current);
  }, [asking]);

  if (asking) {
    return (
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-clay-500/60 bg-ocean-900/95 py-1.5 pl-3 pr-1.5 shadow-2xl backdrop-blur">
        <span className="text-xs font-semibold text-white/80 sm:text-sm">Sure? A wrong call scores nothing.</span>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            onCall();
          }}
          className="rounded-full bg-clay-400 px-3 py-1.5 text-xs font-bold text-ocean-950 hover:bg-clay-300 sm:text-sm"
        >
          Call it
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white sm:text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      disabled={disabled}
      title="This is not a photograph of Earth"
      className="pointer-events-auto flex h-12 items-center gap-2 rounded-full border border-white/20 bg-ocean-900/80 px-4 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:border-clay-500/70 hover:bg-ocean-800 disabled:opacity-40"
    >
      <Rocket className="h-4 w-4 text-clay-300" />
      Not Earth
    </button>
  );
}
