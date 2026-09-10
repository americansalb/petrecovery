'use client';

/**
 * The game's navigation, so nobody has to remember a path. On
 * reunitepets.org it is a row of subtabs under the universal bar (the
 * permitted variation in app/lib/navChrome.js): Play, Rooms, Rankings,
 * Daily, Profile. On the game's own site (NEXT_PUBLIC_SITE=geo, docs/GEO.md)
 * there is no pet chrome, so the same row is the site's header, with
 * the site's name and a ReunitePets link as the way out. Hidden inside
 * a round or a room, which cover the screen and carry their own X.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe2 } from 'lucide-react';
import { isGameSite } from '@/app/lib/geo/site';

const SITE_NAME = process.env.NEXT_PUBLIC_GEO_SITE_NAME || 'Where on Earth';
const HOME_URL = process.env.NEXT_PUBLIC_GEO_HOME_URL || 'https://www.reunitepets.org';

export const GAME_LINKS = [
  { href: '/geo', label: 'Play', exact: true },
  { href: '/geo/rooms', label: 'Rooms' },
  { href: '/geo/leaderboard', label: 'Rankings' },
  { href: '/geo/play?mode=daily', label: 'Daily', never: true },
  { href: '/geo/me', label: 'Profile' },
];

/** A round or a room in progress: the screen is theirs. */
export function isGameTakeover(pathname) {
  return pathname.startsWith('/geo/play') || pathname.startsWith('/geo/room/');
}

function isActive(link, pathname) {
  if (link.never) return false;
  return link.exact ? pathname === link.href : pathname.startsWith(link.href);
}

export default function GeoHeader() {
  const pathname = usePathname() || '';
  if (isGameTakeover(pathname)) return null;

  if (isGameSite()) {
    return (
      <header className="border-b border-midnight-800 bg-midnight-950 text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/geo" className="flex shrink-0 items-center gap-2 font-bold">
            <Globe2 className="h-5 w-5 text-flash-400" />
            {SITE_NAME}
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Game">
            {GAME_LINKS.map((link) => {
              const active = isActive(link, pathname);
              return (
                <Link key={link.href} href={link.href} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  {link.label}
                </Link>
              );
            })}
            <a href={HOME_URL} className="ml-2 hidden shrink-0 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white sm:inline">
              ReunitePets
            </a>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <nav className="sticky top-16 z-40 border-b border-midnight-200 bg-white/95 backdrop-blur" aria-label="Game">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-1 overflow-x-auto px-4">
        <Link href="/geo" className="mr-2 hidden shrink-0 items-center gap-2 font-bold text-midnight-900 sm:flex">
          <Globe2 className="h-4 w-4 text-flash-500" />
          {SITE_NAME}
        </Link>
        {GAME_LINKS.map((link) => {
          const active = isActive(link, pathname);
          return (
            <Link key={link.href} href={link.href} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-midnight-900 text-white' : 'text-midnight-700 hover:bg-midnight-100'}`}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
