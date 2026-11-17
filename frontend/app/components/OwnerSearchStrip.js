'use client';

/**
 * OwnerSearchStrip - the way back to their own search for someone who
 * reported a lost pet without an account.
 *
 * Before this, a guest owner had no way back but the link they saved: on
 * the home page their own dog was a stranger's card, the menu said nothing
 * and the Home tab asked them to sign in. The browser that sent the report
 * keeps the owner's key (app/lib/ownerKey.js), so the site can tell it.
 *
 * It is NOT part of the universal top bar, which stays identical for every
 * person on every route (CLAUDE.md, docs/APP_MAP.md 8.2). It is a strip of
 * its own, mounted once in the root layout right after <Navigation />, under
 * the bar and above the page. The founder approved exactly this on
 * 2026-11-17: "show a slim '<Pet>'s search' banner under the top bar on
 * every page, only in the browser that reported it. ... The bar itself stays
 * identical; a strip below it links to their search."
 *
 * When it shows: only when nobody is signed in and GET /api/owner/open-search
 * answers, for this browser's own cookies, with an open lost search this
 * browser reported. A signed-in owner reaches the search from the account
 * menu and the dashboard, so nothing is asked for them. The words and the
 * link come from that answer alone (app/lib/ownerStrip.js); the key never
 * leaves its HttpOnly cookie. Not drawn in the immersive routes
 * (app/lib/navChrome.js), which have their own way back, nor under the
 * report form, which covers the screen.
 *
 * When it asks: once when the page loads, and again only on coming back
 * from the report form or the search screen, where a search is made or
 * closed. Not on every page.
 *
 * Layout: nothing is held open while the answer is unknown, so a browser
 * without a key never moves. The key's cookie cannot be read by script and
 * the pages are not drawn per visitor, so for an owner the strip appears
 * when the answer comes and moves the page down by its own height, once.
 * It is not sticky: it scrolls away with the page, so subtabs anchored
 * `sticky top-16` still sit right under the bar.
 *
 * Enforced by __tests__/global-chrome.test.js and
 * __tests__/owner-search-strip.test.js.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import PetStatusDot from './PetStatusDot';
import { isImmersiveRoute } from '@/app/lib/navChrome';
import { stripWords, mayChangeOn } from '@/app/lib/ownerStrip';

/** The strip itself, from the words stripWords() made. 44px to tap, 16px type, one line at 375px wide. */
export function OwnerSearchStripView({ words }) {
  if (!words) return null;
  return (
    <Link
      href={words.href}
      data-owner-strip=""
      className="block bg-white border-b border-midnight-200 text-midnight-900 hover:bg-midnight-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-midnight-900 print:hidden"
    >
      <span className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-2 text-base">
        <PetStatusDot status="lost" />
        <span className="font-semibold truncate min-w-0">{words.name}</span>
        {words.status ? (
          <>
            <span className="text-midnight-300 shrink-0" aria-hidden="true">·</span>
            <span className="text-midnight-500 whitespace-nowrap shrink-0">{words.status}</span>
          </>
        ) : null}
        <ChevronRight className="ml-auto w-5 h-5 shrink-0 text-midnight-500" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function OwnerSearchStrip() {
  const pathname = usePathname() || '/';
  const { status } = useSession();
  // The server's answer for this browser: null, or { caseNumber, petName, lostAt, ... }.
  const [open, setOpen] = useState(null);
  // True until the first ask, and again after a page where the answer may have changed.
  const stale = useRef(true);
  // Each ask's number. An answer that arrives after a newer ask, or after signing in, is dropped.
  const asks = useRef(0);

  useEffect(() => {
    if (status !== 'unauthenticated') {
      // Signed in, or not known yet: nothing is asked, and signing out asks afresh.
      asks.current += 1;
      stale.current = true;
      setOpen(null);
      return;
    }
    if (mayChangeOn(pathname)) stale.current = true;
    // Asked where it can be drawn: not inside a takeover, not under the report form.
    if (isImmersiveRoute(pathname) || mayChangeOn(pathname) || !stale.current) return;
    stale.current = false;
    const ask = ++asks.current;
    fetch('/api/owner/open-search', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ask === asks.current) setOpen(data?.open || null);
      })
      .catch(() => {});
  }, [status, pathname]);

  if (status !== 'unauthenticated' || isImmersiveRoute(pathname)) return null;
  return <OwnerSearchStripView words={stripWords(open)} />;
}
