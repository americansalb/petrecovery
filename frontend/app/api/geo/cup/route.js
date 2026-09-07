/**
 * GET /api/geo/cup?week=YYYY-Www   header x-geo-profile (optional)
 *
 * The weekly cup's board (docs/GEO.md, "The weekly cup"): everyone who
 * finished the week's ten, ranked, how many started, when the week
 * ends, the prizes, and your own row with its rank. This week by
 * default. A past week is paid out the first time anyone looks at it
 * after it ended, and last week is paid out on any view of this one.
 */

import { NextResponse } from 'next/server';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { CUP_PRIZES, CUP_ROUNDS, challengeBoard, cupEndsAt, cupKeyFor, finalizeCup } from '@/app/lib/geo/server/challenges';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  const url = new URL(request.url);
  const week = url.searchParams.get('week') || '';
  const now = Date.now();
  const thisWeek = cupKeyFor(now);
  const key = /^\d{4}-W\d{2}$/.test(week) ? `cup:${week}` : thisWeek;
  try {
    const { profileId } = await subjectsFor(request);
    // Prizes: this key if its week is over, and last week's on a view of this week.
    const jobs = [finalizeCup(prismaRoomStore, key, now)];
    if (key === thisWeek) jobs.push(finalizeCup(prismaRoomStore, cupKeyFor(now - 7 * 86400000), now));
    await Promise.all(jobs.map((job) => job.catch((error) => console.error('[geo/cup] prizes', error?.message || error))));
    const board = await challengeBoard(prismaRoomStore, { key, rounds: CUP_ROUNDS, profileId });
    return NextResponse.json({ ok: true, week: key.slice(4), endsAt: cupEndsAt(key), prizes: CUP_PRIZES, ...board }, NO_STORE);
  } catch (error) {
    console.error('[geo/cup]', error);
    return NextResponse.json({ error: "Could not load this week's board", code: 'internal' }, { status: 500, ...NO_STORE });
  }
}
