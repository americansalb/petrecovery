/**
 * /geo/play: the game itself. Settings come from the query string
 * (see app/lib/geo/modes.js), so a link is a whole game. Registered as
 * an immersive route in app/lib/navChrome.js; the X in the HUD leads
 * back to /geo.
 *
 * A server page so a pasted link can say which game it is
 * (app/lib/geo/playMeta.js); the game itself is the client component.
 */

import { Suspense } from 'react';
import PlayClient from '../components/PlayClient';
import { playLinkMetadata } from '@/app/lib/geo/playMeta';

export async function generateMetadata({ searchParams }) {
  return playLinkMetadata(await searchParams);
}

export default function GeoPlayPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-pe-canvas text-pe-muted">Loading</div>}>
      <PlayClient />
    </Suspense>
  );
}
