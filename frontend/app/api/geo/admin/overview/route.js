/**
 * GET /api/geo/admin/overview
 *
 * The numbers on the admin home. Admin only, and the denial says
 * nothing about whether an account exists: every refusal is the same
 * 403 with a reason the operator can act on and an attacker cannot
 * learn from.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin, siteOverview } from '@/app/lib/geo/server/admin';
import { accountView } from '@/app/lib/geo/server/roles';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const account = await requireAdmin(request);
    const overview = await siteOverview();
    return NextResponse.json({ you: accountView(account), overview }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    console.error('[geo/admin/overview]', error?.message || error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
