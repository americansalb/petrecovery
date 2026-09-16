/**
 * GET  /api/geo/admin/accounts?q=  list accounts
 * POST /api/geo/admin/accounts     change one
 *
 * The write takes only the four fields the screen offers, and admin.js
 * validates each of them rather than trusting the body.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, listAccounts, requireAdmin, updateAccount } from '@/app/lib/geo/server/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const query = new URL(request.url).searchParams.get('q') || '';
    const accounts = await listAccounts({ query });
    return NextResponse.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    console.error('[geo/admin/accounts]', error?.message || error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const updated = await updateAccount({
      actor,
      accountId: body.accountId,
      role: body.role,
      tier: body.tier,
      tierUntil: body.tierUntil,
      suspended: body.suspended,
      reason: body.reason,
    });
    if (!updated) return NextResponse.json({ error: 'nothing_to_change' }, { status: 400 });
    return NextResponse.json({ account: updated });
  } catch (error) {
    if (error instanceof AdminDenied) {
      // A refused change is the operator's mistake to see, so this one
      // names it: they are already inside the admin screen.
      const status = error.reason === 'cannot_suspend_self' || error.reason.startsWith('bad_') ? 400 : 403;
      return NextResponse.json({ error: error.reason }, { status });
    }
    console.error('[geo/admin/accounts]', error?.message || error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
