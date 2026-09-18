/**
 * GET /api/geo/auth/me
 *
 * Who the game thinks you are: the address, the role and the tier, or
 * nothing at all. The profile page renders from this, and so does the
 * header when it decides whether to show the admin link.
 *
 * The cookie carries an id and an address, not a role: a role inside a
 * sealed token is a role somebody keeps after it is revoked, and a tier
 * inside one is a tier that outlives the month it was paid for. Both
 * are read from the row on every request instead.
 */

import { NextResponse } from 'next/server';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { accountFromRequest } from '@/app/lib/geo/server/identity';
import { accountView } from '@/app/lib/geo/server/roles';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { accountId, email } = accountFromRequest(request);
  if (!accountId) {
    return NextResponse.json({ ok: true, signedIn: false, email: null, account: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  let account = null;
  // Three outcomes, and only two of them mean signed out.
  //
  //   a row        the truth, role and tier included
  //   no row       the account is gone, so the session is worthless
  //   a failure    the database is unreachable, which says nothing
  //                about the session
  //
  // Collapsing the third into the second signs everybody out whenever
  // the database hiccups, including on a deployment with no database at
  // all, where the session cookie is still perfectly valid.
  let reachable = true;
  try {
    account = await prismaRoomStore.getAccountById(accountId);
  } catch (error) {
    reachable = false;
    console.error('[geo/auth/me]', error?.message || error);
  }
  const view = accountView(account);
  const signedIn = reachable ? Boolean(account) && !view.suspended : true;
  const response = NextResponse.json(
    {
      ok: true,
      // A suspended account is signed out as far as every screen is
      // concerned, so nothing renders as though it still has access.
      signedIn,
      email: view?.email || email || null,
      // Null when the row could not be read: no role, no tier, and no
      // screen rendering privileges it cannot verify.
      account: view,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  // A status request can have started before another tab completed sign-in.
  // Never erase that newer cookie when the old request finally arrives.
  // Explicit sign-out/deletion clears it; invalid sessions grant no access.
  return response;
}
