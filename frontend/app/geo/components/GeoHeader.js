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
import { Compass, ShieldCheck, Trophy, UserRound, Users } from 'lucide-react';
import { isGameTakeover as siteTakeover } from '@/app/lib/geo/site';
import { isSignedIn } from '../lib/session';
import { loadName } from '../lib/useRoom';

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

const TAB_ICONS = {
  '/geo': Compass,
  '/geo/rooms': Users,
  '/geo/leaderboard': Trophy,
  '/geo/me': UserRound,
};

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
  // Signed in or not, for the one session-dependent slot the chrome rule
  // allows. null means "not known yet" and renders neither control: the
  // server and the first client render have to agree, and offering
  // "Create account" to somebody who already has one, even for a moment
  // on every page, is its own small insult. The cookie below settles it
  // on the first effect, so null lasts one render rather than a request.
  const [signedIn, setSignedIn] = useState(null);
  const [who, setWho] = useState('');
  useEffect(() => {
    let live = true;
    // Answer from the readable companion cookie first (app/geo/lib/session.js
    // exists for exactly this: the session itself is httpOnly, so this one
    // carries "am I signed in" and no secret). Waiting on the network instead
    // left the slot empty for the length of a request, which on a phone is
    // long enough that the one thing we want a new player to do is missing
    // from the screen. Read in an effect rather than in the initial state so
    // the server and the first client render still agree.
    setSignedIn(isSignedIn());
    const read = () =>
      fetch('/api/geo/auth/me', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!live) return;
          // A refusal is not an answer. /api/geo/auth/me shares the
          // /api/geo/auth bucket, sixty a minute per address, and an
          // address is a household: a 429 or a dropped connection used
          // to read here as "signed out" and put "Create account" in
          // front of somebody who is already signed in. The cookie
          // above already said which they are; leave it alone unless
          // the server actually answered.
          if (!data) return;
          setAdmin(data.account?.role === 'admin');
          setSignedIn(Boolean(data.signedIn));
          // The player's own name where this browser knows it, which is
          // shorter and friendlier than an address in a phone's header.
          setWho(loadName() || String(data.email || '').split('@')[0] || '');
        })
        .catch(() => {});
    read();
    // Signing in happens without a navigation, so the bar has to hear
    // about it or it keeps asking a signed-in player to sign up.
    window.addEventListener('geo:session-changed', read);
    return () => {
      live = false;
      window.removeEventListener('geo:session-changed', read);
    };
  }, []);

  // A round or a room owns the whole screen, header included.
  if (isGameTakeover(pathname)) return null;

  const links = [
    ...GAME_LINKS,
    ...(admin ? [{ href: '/geo/admin', label: 'Admin', admin: true }] : []),
  ];

  // Everywhere else in the game, on both hosts. The game has its own name
  // and its own domain, so it carries its own bar wherever it is served.
  return (
    <>
      <header className="ui-header">
        <div className="ui-header-inner">
          <Link href="/geo" className="ui-brand">
            <span className="ui-brand-mark" aria-hidden="true">
              <Compass size={19} strokeWidth={2} />
            </span>
            {SITE_NAME}
          </Link>
          <nav className="ui-nav" aria-label="Game">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={isActive(link, pathname) ? 'page' : undefined}>
                {link.admin ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : null}
                {link.label}
              </Link>
            ))}
          </nav>
          {/* The one session-dependent slot the chrome rule allows
              (CLAUDE.md: "Sign in/Join vs the account menu"). Not on the
              sign-in page itself: a button whose whole job is to bring
              you to the screen you are reading does nothing. Either
              control is only known once the page has read the session, a
              moment after it paints, so it fades in rather than popping
              into the bar. */}
          {/* The slot is always there and always the same width, empty or
              not, so the links beside it never move: not while the
              session is being read, not on the sign-in page, and not
              between a Sign in button and a name (the founder's rule for
              the pet site's bar, and the reason for it holds here: a bar
              that rearranges itself reads as broken). */}
          <div className="ui-account-slot" data-account-slot>
            {signedIn === false && !pathname.startsWith('/geo/signin') ? (
              <Link href="/geo/signin" className="pe-fade-in ui-btn ui-btn--primary ui-btn--sm">
                Sign in
              </Link>
            ) : null}
            {signedIn === true ? (
              <Link href="/geo/me" className="pe-fade-in ui-account" title={who ? `Signed in as ${who}` : 'Your profile'}>
                <UserRound size={16} strokeWidth={2} aria-hidden="true" />
                <span>{who || 'Account'}</span>
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      {/* The same four places, at the bottom of a phone's screen. */}
      <nav className="ui-tabbar" aria-label="Game sections">
        {GAME_LINKS.map((link) => {
          const Icon = TAB_ICONS[link.href] || Compass;
          return (
            <Link key={link.href} href={link.href} aria-current={isActive(link, pathname) ? 'page' : undefined}>
              <Icon size={21} strokeWidth={isActive(link, pathname) ? 2.25 : 1.75} aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
