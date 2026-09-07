'use client';

/**
 * /geo/play: the game itself. Settings come from the query string
 * (see app/lib/geo/modes.js), so a link is a whole game. Registered as
 * an immersive route in app/lib/navChrome.js; the X in the HUD leads
 * back to /geo.
 */

import { Suspense } from 'react';
import PlayClient from '../components/PlayClient';

export default function GeoPlayPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-midnight-950 text-white/70">Loading</div>}>
      <PlayClient />
    </Suspense>
  );
}
