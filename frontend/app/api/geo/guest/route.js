/**
 * GET /api/geo/guest   header x-geo-profile (optional)
 *
 * Today's guest pass for this browser (server/guestPass.js): how many
 * games a guest has, how many are left and when they come back. The
 * header's Guest chip, the menu and the end of a game read it. A
 * signed-in player gets { guest: false }. Never creates a profile.
 */

import { NextResponse } from 'next/server';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';
import { guestAllowance } from '@/app/lib/geo/server/guestPass';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  try {
    const subjects = await subjectsFor(request);
    return NextResponse.json({ ok: true, ...(await guestAllowance(prismaRoomStore, subjects)) }, NO_STORE);
  } catch (error) {
    console.error('[geo/guest]', error?.message || error);
    // Not knowing is not the same as having none left: say nothing, and
    // the screens show no count rather than a wrong one.
    return NextResponse.json({ ok: false, error: 'Could not read the guest pass' }, { status: 503, ...NO_STORE });
  }
}
