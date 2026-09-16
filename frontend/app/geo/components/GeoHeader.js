'use client';

/**
 * The game's navigation, so nobody has to remember a path. On
 * reunitepets.org it is a row of subtabs under the universal bar (the
 * permitted variation in app/lib/navChrome.js): Play, Rooms, Rankings,
 * Daily, Profile. On the game's own site (NEXT_PUBLIC_SITE=geo, docs/GEO.md)
 * there is no pet chrome, so the same row is the site's header, with
 * the site's name and the game's own links. The way back to the pet
 * site lives in the footer instead: this is a site of its own, and a
 * link out of it does not belong in its navigation. Hidden inside
 * a round or a room, which cover the screen and carry their own X.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe2 } from 'lucide-react';
import { isGameTakeover as siteTakeover } from '@/app/lib/geo/site';

const SITE_NAME = process.env.NEXT_PUBLIC_GEO_SITE_NAME || 'Probably Earth';

export const GAME_LINKS = [
  { href: '/geo/setup', label: 'Play' },
  { href: '/geo/script', label: 'Script' },
  { href: '/geo/rooms', label: 'Rooms' },
  { href: '/geo/leaderboard', label: 'Rankings' },
  { href: '/geo/play?mode=daily', label: 'Daily', never: true },
  { href: '/geo/me', label: 'Profile' },
];

/**
 * The screens that own the whole viewport. One list, in site.js, so the
 * header and the footer cannot disagree about what a takeover is. The
 * front door is one of them now: it is a full-screen picture of the
 * world with its own small header, and a second bar above that is
 * exactly the thing the redesign removed.
 */
export const isGameTakeover = siteTakeover;

function isActive(link, pathname) {
  if (link.never) return false;
  return link.exact ? pathname === link.href : pathname.startsWith(link.href);
}

export default function GeoHeader() {
  const pathname = usePathname() || '';
  // A round or a room owns the whole screen, header included.
  if (isGameTakeover(pathname)) return null;

  // Everywhere else in the game, on both hosts. This used to render the
  // dark bar only on a NEXT_PUBLIC_SITE=geo build and a row of subtabs
  // under the pet site's bar otherwise. The game has its own name and
  // its own domain now, so it carries its own bar wherever it is served.
  return (
    <header className="border-b border-ocean-800 bg-ocean-950 text-sand-50">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/geo" className="flex shrink-0 items-center gap-2 font-bold">
          <Globe2 className="h-5 w-5 text-clay-300" />
          {SITE_NAME}
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Game">
          {GAME_LINKS.map((link) => {
            const active = isActive(link, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-sand-50/15 text-white' : 'text-sand-100/70 hover:bg-sand-50/10 hover:text-white'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
