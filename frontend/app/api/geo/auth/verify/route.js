/**
 * GET /api/geo/auth/verify?token=...
 *
 * Follow a sign-in link. A GET because it is a link in an email, so the
 * link is single use and short-lived rather than idempotent: following
 * it twice signs you in once and then says the link is spent.
 *
 * Redirects rather than returning JSON, because a person clicked it and
 * should land on their profile, not on a wall of braces.
 */

import { NextResponse } from 'next/server';
import { GeoAuthError, verifySignIn } from '@/app/lib/geo/server/accounts';
import { applySession } from '@/app/lib/geo/server/identity';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { safeReturnTo } from '@/app/lib/geo/authReturn';
import { geoMetadataBase } from '@/app/lib/geo/server/siteBase';
import { geoAuthOrigin } from '@/app/lib/geo/authOrigin';

export const dynamic = 'force-dynamic';

const WHY = {
  invalid: 'that-link-is-not-valid',
  expired: 'that-link-expired',
  used: 'that-link-was-already-used',
};


export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const returnTo = safeReturnTo(url.searchParams.get('next'));
  const origin = geoAuthOrigin((await geoMetadataBase()).origin);

  try {
    const { account, profile } = await verifySignIn(prismaRoomStore, { token });
    const target = new URL(returnTo, origin);
    target.searchParams.set('signed-in', '1');
    const done = NextResponse.redirect(target);
    applySession(done, { accountId: account.id, email: account.email });
    // The browser keeps playing as whichever profile the account owns.
    done.headers.set('x-geo-profile-id', profile?.id || '');
    return done;
  } catch (error) {
    if (error instanceof GeoAuthError) {
      return NextResponse.redirect(new URL(`/geo/signin?sign-in-failed=${WHY[error.code] || 'unknown'}&next=${encodeURIComponent(returnTo)}`, origin));
    }
    console.error('[geo/auth/verify]', error?.message || error);
    return NextResponse.redirect(new URL(`/geo/signin?sign-in-failed=unknown&next=${encodeURIComponent(returnTo)}`, origin));
  }
}
