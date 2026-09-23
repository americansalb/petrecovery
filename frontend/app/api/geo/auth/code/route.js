/**
 * POST /api/geo/auth/code   { email, code }
 *
 * Sign in with the six-digit code from the sign-in email, in the tab
 * that asked for it (accounts.js says why the code is the main way in).
 * Sets the same session the emailed link sets. Rate-limited in
 * middleware.js, on top of the five wrong codes an email survives.
 */

import { NextResponse } from 'next/server';
import { GeoAuthError, verifySignInCode } from '@/app/lib/geo/server/accounts';
import { applySession } from '@/app/lib/geo/server/identity';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with an email address and a code' }, { status: 400 });
  }
  try {
    const { account, profile } = await verifySignInCode(prismaRoomStore, {
      email: body?.email,
      code: body?.code,
      profileToken: request.headers.get('x-geo-profile') || '',
    });
    const done = NextResponse.json(
      { ok: true, signedIn: true, email: account.email || null, profile: profile ? { id: profile.id, name: profile.name } : null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
    applySession(done, { accountId: account.id, email: account.email });
    return done;
  } catch (error) {
    if (error instanceof GeoAuthError) {
      const status = error.code === 'not_configured' ? 503 : error.code === 'suspended' ? 403 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[geo/auth/code]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'Could not sign you in'), { status: 500 });
  }
}
