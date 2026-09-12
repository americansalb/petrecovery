/**
 * POST /api/geo/auth/delete
 *
 * Delete this game account and the profile bound to it, for good.
 *
 * The game holds an email address, a display name, ratings, points,
 * badges and a record of games played, and until this route there was
 * no way to get rid of any of it (docs/GEO.md, "Signing in"). Deleting
 * needs the session cookie, so only the person holding the account can
 * do it; nothing about the pet site is touched, because a WanderGuesser
 * account is not a ReunitePets one.
 */

import { NextResponse } from 'next/server';
import { accountFromRequest, clearSession } from '@/app/lib/geo/server/identity';
import { deleteAccount } from '@/app/lib/geo/server/accounts';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = accountFromRequest(request);
  if (!session?.accountId) {
    return NextResponse.json({ error: 'Sign in first', code: 'not_signed_in' }, { status: 401 });
  }
  try {
    const removed = await deleteAccount(prismaRoomStore, { accountId: session.accountId });
    return clearSession(
      NextResponse.json({ ok: true, ...removed }, { headers: { 'Cache-Control': 'no-store' } })
    );
  } catch (error) {
    console.error('[geo/auth/delete]', error?.message || error);
    return NextResponse.json({ error: 'Could not delete that account', code: 'internal' }, { status: 500 });
  }
}
