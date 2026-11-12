/**
 * GET /api/mission/[missionId]/own?k=<key>
 *
 * The owner's link, from the email sent when a report is made without an
 * account (app/lib/ownerKey.js). It swaps the key in the link for the
 * cookie that carries it and goes to Mission Control, where the person is
 * now the owner of that one search: on any phone or computer, with no
 * password.
 *
 * A key that is wrong or too old changes nothing: the search opens as it
 * does for anyone with its link, and says how the owner signs in. So the
 * answer is the same either way, and nothing is learned by trying keys.
 * The link is long and random, and the route is rate limited all the same.
 */
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { getBaseUrl } from '@/app/lib/config';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';
import { keyIsFresh, keyMatches, ownerCookie } from '@/app/lib/ownerKey';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const OWN_LIMIT = { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 10 * 60 * 1000 };

export async function GET(request, { params }) {
  const limit = await withRateLimitAsync(request, OWN_LIMIT, 'mission:own');
  if (!limit.success) return rateLimitResponse(limit);
  const { missionId } = await params;
  const key = new URL(request.url).searchParams.get('k');
  const pet = await prisma.case.findFirst({ where: missionWhere(missionId), select: { id: true, caseNumber: true, ownerKeyHash: true, ownerKeyAt: true } }).catch(() => null);
  // Always the same place, at the site's own address: with the key, as the owner.
  const to = NextResponse.redirect(`${getBaseUrl()}/mission-control?mission=${encodeURIComponent(pet?.caseNumber || missionId)}`, 303);
  // The key must not stay in the address bar's history as a page, be sent on as a referrer, or be kept by a cache.
  to.headers.set('Referrer-Policy', 'no-referrer');
  to.headers.set('Cache-Control', 'no-store');
  if (pet && keyIsFresh(pet.ownerKeyAt) && keyMatches(key, pet.ownerKeyHash)) {
    const kept = ownerCookie(pet.id, key);
    to.cookies.set(kept.name, kept.value, kept.options);
    logEvent({ event_type: 'owner_key.opened', resource_type: 'case', resource_id: pet.id, action: 'read', result: 'success' }).catch(() => {});
  }
  return to;
}
