import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import missingPeople from '@/app/rasuwa/missing-people.json';
import { aggregateRecipientCounts, buildCoverage, coverageForPublic } from '@/app/rasuwa/team/teamLogic';

/**
 * GET /api/rasuwa/progress - the public chart: every missing person,
 * how many letters the record holds for them, and how many people have
 * said they will write (a count only; the names live behind the team
 * board's code). Cached one minute per server so the whole campaign
 * refreshing the chart costs a couple of queries a minute.
 *
 * Rate limited in middleware.js ('/api/rasuwa/progress').
 */

export const dynamic = 'force-dynamic';

const TTL_MS = 60 * 1000;
let cache = { at: 0, body: null };

export async function GET() {
  const now = Date.now();
  if (!cache.body || now - cache.at > TTL_MS) {
    try {
      const [rows, claims] = await Promise.all([
        prisma.rasuwaLetterRecord.findMany({
          select: { personName: true, recipients: true },
          take: 5000,
        }),
        prisma.rasuwaPersonClaim.findMany({ take: 1000 }),
      ]);
      const { letterCounts, officesByKey } = aggregateRecipientCounts(rows);
      cache = {
        at: now,
        body: coverageForPublic(
          buildCoverage({ people: missingPeople.people, letterCounts, claims }),
          officesByKey
        ),
      };
    } catch {
      if (!cache.body) {
        return NextResponse.json(
          { error: 'The chart is unavailable right now.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      cache.at = now;
    }
  }
  return NextResponse.json(cache.body, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
