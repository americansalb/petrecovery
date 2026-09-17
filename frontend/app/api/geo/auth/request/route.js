/**
 * POST /api/geo/auth/request   { email }
 *
 * Ask for a sign-in link. Always answers the same way whether or not an
 * account exists, so this endpoint cannot be used to find out who has
 * one. Rate-limited hard in middleware.js: it sends mail.
 */

import { NextResponse } from 'next/server';
import { GeoAuthError, requestSignIn } from '@/app/lib/geo/server/accounts';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { geoMetadataBase } from '@/app/lib/geo/server/siteBase';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';

export const dynamic = 'force-dynamic';

const SAME_ANSWER = {
  ok: true,
  message: 'If that address can receive mail, a sign-in link is on its way. It expires in fifteen minutes.',
};

function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/geo')) return '';
  if (value.startsWith('//') || /[\
]/.test(value)) return '';
  return value.slice(0, 500);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with an email address' }, { status: 400 });
  }

  let profileId = null;
  try {
    ({ profileId } = await subjectsFor(request));
  } catch (error) {
    console.error('[geo/auth/request] profile', error?.message || error);
  }

  try {
    const result = await requestSignIn(prismaRoomStore, {
      email: body?.email,
      baseUrl: geoMetadataBase().toString(),
      profileId,
      returnTo: safeReturnTo(body?.returnTo),
    });
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
    return NextResponse.json(schemaErrorBody(error, 'Could not start sign-in'), { status: 500 });
  }
}