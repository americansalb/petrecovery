/**
 * GET /api/geo/admin/rooms
 *
 * What is being played right now, and what was played recently. Codes
 * are included because a code is how an operator reaches a room that is
 * misbehaving; nothing else about a player is.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, listRooms, requireAdmin } from '@/app/lib/geo/server/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const rooms = await listRooms({});
    return NextResponse.json({ rooms }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    console.error('[geo/admin/rooms]', error?.message || error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
