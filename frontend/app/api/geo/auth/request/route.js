/**
 * POST /api/geo/auth/request   { email }
 *
 * Ask for a sign-in link. Always answers the same way whether or not an
 * account exists, so this endpoint cannot be used to find out who has
 * one. Rate-limited hard in middleware.js: it sends mail.
 */

import { NextResponse } from 'next/server';
import { GeoAuthError, requestSignIn } from '@/app/lib/geo/server/accounts';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { geoMetadataBase } from '@/app/lib/geo/server/siteBase';

export const dynamic = 'force-dynamic';

const SAME_ANSWER = {
  ok: true,
  message: 'If that address can receive mail, a sign-in link is on its way. It expires in fifteen minutes.',
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with an email address' }, { status: 400 });
  }

  try {
    const result = await requestSignIn(prismaRoomStore, { email: body?.email, baseUrl: geoMetadataBase().toString() });
    // A mail failure is worth saying out loud: silently claiming to have
    // sent something we did not would leave the player waiting forever.
    if (!result.sent) {
      return NextResponse.json({ error: 'We could not send that link. Try again in a minute.', code: 'send_failed' }, { status: 502 });
    }
    return NextResponse.json(SAME_ANSWER, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof GeoAuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[geo/auth/request]', error?.message || error);
    return NextResponse.json({ error: 'Could not start sign-in', code: 'internal' }, { status: 500 });
  }
}
