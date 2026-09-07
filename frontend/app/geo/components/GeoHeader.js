'use client';

/**
 * The game's own header. Where on Earth is an immersive segment
 * (app/lib/navChrome.js): it ships this bar instead of the pet site's,
 * so it reads the same on reunitepets.org and on a game domain of its
 * own. The ReunitePets link is the way back out. Hidden inside a round
 * or a room, which cover the screen and carry their own X.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe2 } from 'lucide-react';

const SITE_NAME = process.env.NEXT_PUBLIC_GEO_SITE_NAME || 'Where on Earth';
const HOME_URL = process.env.NEXT_PUBLIC_GEO_HOME_URL || 'https://www.reunitepets.org';

const LINKS = [
  { href: '/geo', label: 'Play' },
  { href: '/geo/rooms', label: 'Rooms' },
  { href: '/geo/leaderboard', label: 'Rankings' },
];

export default function GeoHeader() {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/geo/play') || pathname.startsWith('/geo/room/')) return null;
  return (
    <header className="border-b border-midnight-800 bg-midnight-950 text-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/geo" className="flex items-center gap-2 font-bold">
          <Globe2 className="h-5 w-5 text-flash-400" />
          {SITE_NAME}
        </Link>
        <nav className="flex items-center gap-1" aria-label="Game">
          {LINKS.map((link) => {
            const active = link.href === '/geo' ? pathname === '/geo' : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                {link.label}
              </Link>
            );
          })}
          <a href={HOME_URL} className="ml-2 hidden rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white sm:inline">
            ReunitePets
          </a>
        </nav>
      </div>
    </header>
  );
}
