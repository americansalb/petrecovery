'use client';

/**
 * The game's footer: where the pictures and the country outlines come
 * from, and the way back to ReunitePets.
 *
 * It carries the link out, which is what lets the game take the whole
 * screen from the pet site's bar: the founder rule says an immersive
 * route may drop that bar as long as it ships a visible way out
 * (docs/APP_MAP.md, 8.2). This is that way out, on every game page
 * except the takeovers, which have an X of their own.
 */


import { usePathname } from 'next/navigation';
import { isGameTakeover } from '@/app/lib/geo/site';

const HOME_URL = process.env.NEXT_PUBLIC_GEO_HOME_URL || 'https://www.reunitepets.org';

export default function GeoFooter() {
  const pathname = usePathname() || '';
  if (isGameTakeover(pathname)) return null;
  return (
    <footer className="border-t border-sand-200 bg-sand-100 text-xs text-sand-700">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5">
        <p>
          Imagery from Google Street View and Apple Look Around, shown under their own terms. Country outlines from Natural
          Earth. Script sentences from{' '}
          <a href="https://tatoeba.org" className="underline hover:text-ocean-700" rel="noreferrer noopener" target="_blank">
            Tatoeba
          </a>
          , CC-BY 2.0 FR.
        </p>
        <a href={HOME_URL} className="font-semibold text-sand-800 hover:text-ocean-700 hover:underline">
          Made by ReunitePets
        </a>
      </div>
    </footer>
  );
}
