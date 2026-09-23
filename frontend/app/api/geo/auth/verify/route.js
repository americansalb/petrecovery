/**
 * /api/geo/auth/verify
 *
 * The Sign in button in the sign-in email.
 *
 * GET is the link itself, and it spends nothing. It used to sign in on
 * the spot, and opening links is exactly what mail security scanners do:
 * Microsoft Defender, Mimecast, Proofpoint and others fetch every link in
 * a message as it arrives. The scanner's visit spent the link and, with
 * it, the six-digit code from the same email (they are one sign-in), so
 * a player behind one was told "That code has already been used" for
 * every code they were sent, and could not sign in at all.
 *
 * So GET only takes the browser to the sign-in page with the link, and
 * that page asks for one press of Sign in: POST, below, which is the only
 * thing that spends it. A scanner fetches pages; it does not press
 * buttons.
 *
 * POST answers with JSON, because the page asked, not a person.
 */

import { NextResponse } from 'next/server';
import { GeoAuthError, verifySignIn } from '@/app/lib/geo/server/accounts';
import { applySession } from '@/app/lib/geo/server/identity';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';
import { safeReturnTo } from '@/app/lib/geo/authReturn';
import { geoMetadataBase } from '@/app/lib/geo/server/siteBase';
import { geoAuthOrigin } from '@/app/lib/geo/authOrigin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const returnTo = safeReturnTo(url.searchParams.get('next'));
  const origin = geoAuthOrigin((await geoMetadataBase()).origin);
  const target = new URL('/geo/signin', origin);
  if (token) target.searchParams.set('link', token);
  target.searchParams.set('next', returnTo);
  return NextResponse.redirect(target);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with the link token' }, { status: 400 });
  }
  const token = typeof body?.token === 'string' ? body.token : '';
  try {
    // No profile token, on purpose: the link binds the profile recorded
    // when the email was asked for (accounts.js, bindAccount), the same
    // as it did when following it signed in by itself.
    const { account, profile } = await verifySignIn(prismaRoomStore, { token });
    const done = NextResponse.json(
      {
        ok: true,
        signedIn: true,
        email: account.email || null,
        profile: profile ? { id: profile.id, name: profile.name } : null,
        next: safeReturnTo(body?.next),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
    applySession(done, { accountId: account.id, email: account.email });
    return done;
  } catch (error) {
    if (error instanceof GeoAuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'suspended' ? 403 : 400 });
    }
    console.error('[geo/auth/verify]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'Could not sign you in'), { status: 500 });
  }
}
