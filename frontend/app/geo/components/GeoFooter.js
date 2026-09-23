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


import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isGameTakeover } from '@/app/lib/geo/site';

const HOME_URL = process.env.NEXT_PUBLIC_GEO_HOME_URL || 'https://www.reunitepets.org';

export default function GeoFooter() {
  const pathname = usePathname() || '';
  if (isGameTakeover(pathname)) return null;
  return (
    <footer className="border-t border-pe-line text-xs text-pe-subtle">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <p className="max-w-2xl leading-relaxed">
          Imagery from Apple Look Around, shown under Apple&apos;s terms. Not Earth panoramas from NASA, public domain.
          Country outlines from Natural Earth. Script sentences from{' '}
          <a href="https://tatoeba.org" className="underline decoration-pe-line-strong underline-offset-2 hover:text-pe-fg" rel="noreferrer noopener" target="_blank">
            Tatoeba
          </a>
          , CC-BY 2.0 FR.
        </p>
        <div className="flex shrink-0 gap-4">
          <Link href="/geo/privacy" className="hover:text-pe-fg">Privacy</Link>
          <a href={HOME_URL} className="font-medium text-pe-muted hover:text-pe-fg">
            Made by ReunitePets
          </a>
        </div>
      </div>
      {/* The phone tab bar (GeoHeader) is fixed over the bottom of the
          screen; this keeps the last line of the page above it. */}
      <div className="ui-tabbar-space" aria-hidden="true" />
    </footer>
  );
}
