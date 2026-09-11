/**
 * GET /api/geo/auth/me
 *
 * Who the game thinks you are: the account's email, or nothing. Used by
 * the profile page to show the signed-in state. Never creates anything.
 */

import { NextResponse } from 'next/server';
import { accountFromRequest } from '@/app/lib/geo/server/identity';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { accountId, email } = accountFromRequest(request);
  return NextResponse.json(
    { ok: true, signedIn: Boolean(accountId), email: email || null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
