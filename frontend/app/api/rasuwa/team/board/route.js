import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import missingPeople from '@/app/rasuwa/missing-people.json';
import { hasTeamCookie } from '@/app/rasuwa/team/teamAuth';
import { aggregateRecipientCounts, buildCoverage } from '@/app/rasuwa/team/teamLogic';

/**
 * GET /api/rasuwa/team/board - the whole board in one read, so the
 * client polls a single endpoint: pinned updates, the recent messages,
 * every need, and the coverage wall (the list of the missing joined
 * with the letter record's per-person counts and the standing "I'll
 * write for them" claims).
 *
 * Board cookie required (teamAuth.js). Rate limited in middleware; the
 * cap is sized for a room of families polling behind one venue IP.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  if (!hasTeamCookie(request)) {
    return NextResponse.json({ error: 'join' }, { status: 401, ...NO_STORE });
  }
  try {
    const [updates, messagesDesc, needs, openCorrections, doneCorrections, letterRows, claims] =
      await Promise.all([
        prisma.rasuwaTeamPost.findMany({
          where: { kind: 'update' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.rasuwaTeamPost.findMany({
          where: { kind: 'message' },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.rasuwaTeamNeed.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
        // Open requests are fetched on their own so a run of handled
        // ones can never push an unresolved request past the cap and
        // off the board (review finding on PR #233).
        prisma.rasuwaCorrection.findMany({
          where: { status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        prisma.rasuwaCorrection.findMany({
          where: { status: 'DONE' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        // Same rows and counting as the public chart, so the wall and
        // the chart never disagree on what a letter is: one recipient
        // entry (review finding on PR #235). Newest first keeps the
        // capped set the recent one.
        prisma.rasuwaLetterRecord.findMany({
          select: { personName: true, recipients: true },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        }),
        prisma.rasuwaPersonClaim.findMany({ orderBy: { createdAt: 'asc' }, take: 1000 }),
      ]);
    return NextResponse.json(
      {
        updates,
        messages: messagesDesc.reverse(),
        needs,
        corrections: [...openCorrections, ...doneCorrections],
        coverage: buildCoverage({
          people: missingPeople.people,
          letterCounts: aggregateRecipientCounts(letterRows).letterCounts,
          claims,
        }),
      },
      NO_STORE
    );
  } catch {
    return NextResponse.json(
      { error: 'The board is unavailable right now. It retries on its own.' },
      { status: 503, ...NO_STORE }
    );
  }
}
