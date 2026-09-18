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
import { useEffect, useState } from 'react';
import { Compass, ShieldCheck } from 'lucide-react';
import { isGameTakeover as siteTakeover } from '@/app/lib/geo/site';

const SITE_NAME = process.env.NEXT_PUBLIC_GEO_SITE_NAME || 'Probably Earth';

/**
 * Four, and the same four everywhere outside a match.
 *
 * It was six - Play, Script, Rooms, Rankings, Daily, Profile - which
 * made Script and Daily look like peers of the whole street game and
 * still left Ranked, the cup and the casual modes findable only by
 * reading a standings page. They live in the menu now, so the bar
 * carries the four places rather than the eight things.
 *
 * Play is the menu: it is where you choose, and the quick start is on
 * it. Multiplayer remains /geo/rooms because a
 * label is not a reason to break an inbound link.
 */
export const GAME_LINKS = [
  { href: '/geo', label: 'Play', exact: true },
  { href: '/geo/rooms', label: 'Multiplayer' },
  { href: '/geo/leaderboard', label: 'Rankings' },
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
  // Admins get one more link. Asked of the server rather than read from
  // a cookie: the browser is told its role so it can render, and is
  // never believed about it. The link is a convenience, and /geo/admin
  // checks again on every request behind it.
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/geo/auth/me', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (live) setAdmin(data?.account?.role === 'admin');
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // A round or a room owns the whole screen, header included.
  if (isGameTakeover(pathname)) return null;

  // Everywhere else in the game, on both hosts. This used to render the
  // dark bar only on a NEXT_PUBLIC_SITE=geo build and a row of subtabs
  // under the pet site's bar otherwise. The game has its own name and
  // its own domain now, so it carries its own bar wherever it is served.
  return (
    <header className="pe-header">
      <div className="pe-header-inner">
        <Link href="/geo" className="pe-brand">
          <span className="pe-brand-mark">
            <Compass size={25} strokeWidth={1.5} />
          </span>
          {SITE_NAME}
        </Link>
        <nav className="pe-nav" aria-label="Game">
          {[
            ...GAME_LINKS,
            ...(admin
              ? [{ href: '/geo/admin', label: 'Admin', admin: true }]
              : []),
          ].map((link) => {
            const active = isActive(link, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
              >
                {link.admin ? (
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                ) : null}
                {link.label}
              </Link>
            );
          })}
        </nav>
        <span className="pe-header-free">
          <span /> FREE TO PLAY
        </span>
      </div>
    </header>
  );
}
