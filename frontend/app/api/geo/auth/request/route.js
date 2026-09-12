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
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';

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

  // The play profile this browser is asking from, so the link can bind
  // it to the account. A failure here only costs the binding.
  let profileId = null;
  try {
    ({ profileId } = await subjectsFor(request));
  } catch (error) {
    console.error('[geo/auth/request] profile', error?.message || error);
  }

  try {
    const result = await requestSignIn(prismaRoomStore, { email: body?.email, baseUrl: geoMetadataBase().toString(), profileId });
    // A mail failure is worth saying out loud: silently claiming to have
    // sent something we did not would leave the player waiting forever.
    if (!result.sent) {
      const noKey = result.reason === 'no_mail_key';
      return NextResponse.json(
        {
          error: noKey
            ? 'Sign-in is not set up on this server yet. Play without an account for now.'
            : 'We could not send that link. Try again in a minute.',
          code: noKey ? 'mail_not_configured' : 'send_failed',
        },
        { status: noKey ? 503 : 502 }
      );
    }
    // Outside production a server with no mail key writes the link to
    // the log instead of sending it. Say so rather than telling the
    // player to watch an inbox nothing is coming to.
    if (!result.delivered) {
      return NextResponse.json(
        { ok: true, message: 'No mail account is set up here, so the sign-in link was written to the server log.', code: 'logged_not_sent' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
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
