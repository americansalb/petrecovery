import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { hasTeamCookie } from '@/app/rasuwa/team/teamAuth';
import { cleanTeamNeed } from '@/app/rasuwa/team/teamLogic';

/**
 * POST /api/rasuwa/team/needs { author, title, detail } - add one
 * thing that needs doing to the board, open for anyone to claim.
 * Board cookie required.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function POST(request) {
  if (!hasTeamCookie(request)) {
    return NextResponse.json({ error: 'join' }, { status: 401, ...NO_STORE });
  }
  let input = null;
  try {
    input = await request.json();
  } catch {
    // cleanTeamNeed(null) rejects below
  }
  const need = cleanTeamNeed(input || {});
  if (!need) {
    return NextResponse.json(
      { error: 'A need needs your name and what should be done.' },
      { status: 400, ...NO_STORE }
    );
  }
  try {
    const created = await prisma.rasuwaTeamNeed.create({ data: need });
    return NextResponse.json({ need: created }, NO_STORE);
  } catch {
    return NextResponse.json(
      { error: 'The board could not save that. Try again in a moment.' },
      { status: 503, ...NO_STORE }
    );
  }
}
