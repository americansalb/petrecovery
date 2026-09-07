/**
 * GET /api/geo/daily?date=YYYY-MM-DD   header x-geo-profile (optional)
 *
 * The daily challenge's board (docs/GEO.md, "The daily challenge"):
 * everyone who finished today's five, ranked, how many started, and your
 * own row with its rank when the request carries a profile. Today by
 * default; any past day by date.
 */

import { NextResponse } from 'next/server';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { challengeBoard, dailyKeyFor } from '@/app/lib/geo/server/challenges';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : new Date().toISOString().slice(0, 10);
  try {
    const { profileId } = await subjectsFor(request);
    const board = await challengeBoard(prismaRoomStore, { key: dailyKeyFor(`${day}T00:00:00Z`), profileId });
    return NextResponse.json({ ok: true, date: day, ...board }, NO_STORE);
  } catch (error) {
    console.error('[geo/daily]', error);
    return NextResponse.json({ error: "Could not load today's board", code: 'internal' }, { status: 500, ...NO_STORE });
  }
}
