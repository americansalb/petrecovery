/**
 * A game address that does not exist.
 *
 * Without this, an unmatched path under /geo fell through to the pet
 * site's 404 (app/not-found.js): a player on probablyearth.com who
 * mistyped a room link was shown ReunitePets branding, a paw print, and
 * links to Lost & Found and Report Pet. The game is a site of its own
 * (docs/GEO.md), so its dead ends have to land in it.
 *
 * A server component on purpose: it inherits the game's header and
 * footer from app/geo/layout.js, so the way out is the navigation the
 * player already knows rather than a button invented for this page.
 */

import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function GeoNotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center sm:py-24">
      <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 text-white/70">
        <Compass size={30} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        That page is not here
      </h1>
      <p className="mt-3 text-sm text-white/70">
        Check the link, or start a game from the menu.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/geo" className="ui-btn ui-btn--primary pe-button pe-button--primary">
          Play
        </Link>
        <Link href="/geo/rooms" className="pe-button min-h-[44px] rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold">
          Multiplayer
        </Link>
      </div>
    </main>
  );
}
