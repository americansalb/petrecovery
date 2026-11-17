/**
 * The words and the link of the strip under the top bar that takes a guest
 * owner back to their own search (app/components/OwnerSearchStrip.js).
 *
 * Someone who reported a lost pet without an account had no way back to
 * the search but the link they saved. The browser that sent the report
 * keeps the owner's key (app/lib/ownerKey.js), and GET /api/owner/open-search
 * answers, for that browser alone, with the newest lost search it reported
 * that is still open. The strip is built from that answer and nothing else.
 *
 * Founder, 2026-11-17, approving it: "show a slim '<Pet>'s search' banner
 * under the top bar on every page, only in the browser that reported it.
 * ... The bar itself stays identical; a strip below it links to their
 * search." Pure, so every word is tested (__tests__/global-chrome.test.js).
 */
import { caseTimeline } from '@/app/lib/caseLabels';

/** Where the strip goes: the owner's own search, the same place the report form's notice sends them. */
export function stripHref(caseNumber) {
  return `/mission-control?mission=${encodeURIComponent(String(caseNumber))}`;
}

/**
 * { name, status, href } for the strip, or null when the answer
 * names no search. `name` is "Rufus's search"; `status` is "Missing 3 days"
 * or "Missing 5 hours", the pet's page's own words from the same function,
 * so the strip and the page under it never give two different times; ''
 * without a date. The answer is only ever an open lost search.
 */
export function stripWords(open, now = Date.now()) {
  if (!open || typeof open.caseNumber !== 'string' || !open.caseNumber) return null;
  const pet = typeof open.petName === 'string' ? open.petName.trim() : '';
  const name = pet ? `${pet}'s search` : "Your pet's search";
  const at = open.lostAt ? new Date(open.lostAt) : null;
  const status = at && Number.isFinite(at.getTime()) ? caseTimeline({ reportType: 'LOST', status: 'ACTIVE', lastSeenAt: at }, now) : '';
  return { name, status, href: stripHref(open.caseNumber) };
}

/**
 * Whether the answer may have changed while the visitor was on `path`: the
 * report form makes a search, and the search screen is where it is closed.
 * The strip asks once when the page loads, and again only on coming back
 * from one of these.
 */
export function mayChangeOn(path) {
  const p = String(path || '');
  return p.startsWith('/report/') || p === '/mission-control' || p.startsWith('/mission-control/');
}
