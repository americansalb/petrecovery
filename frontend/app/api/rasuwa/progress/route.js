import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import missingPeople from '@/app/rasuwa/missing-people.json';
import { GENERAL_RECORD_NAME } from '@/app/rasuwa/letterData';
import {
  aggregateRecipientCounts,
  buildCoverage,
  coverageForPublic,
  normalizePersonKey,
  summarizeRecords,
} from '@/app/rasuwa/team/teamLogic';

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
        // Newest records first, so when the table outgrows the cap the
        // last-24-hours number stays exact and the lifetime numbers
        // become floors, which is how this site states every count
        // (review finding on PR #235).
        prisma.rasuwaLetterRecord.findMany({
          select: { personName: true, recipients: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        }),
        prisma.rasuwaPersonClaim.findMany({ take: 1000 }),
      ]);
      const { letterCounts, officesByKey } = aggregateRecipientCounts(rows);
      const body = coverageForPublic(
        buildCoverage({ people: missingPeople.people, letterCounts, claims }),
        officesByKey
      );
      // Letters written for everyone at once (no one person named) are
      // recorded under a shared name; the chart shows them as their own
      // count above the per-person rows.
      const generalKey = normalizePersonKey(GENERAL_RECORD_NAME);
      const generalCount = letterCounts.find((c) => normalizePersonKey(c.personName) === generalKey);
      body.general = {
        letters: generalCount ? generalCount.letters : 0,
        offices: officesByKey[generalKey] || [],
      };
      // The collective numbers across every record: total letters,
      // offices written to, the last day's pace, most-written offices.
      body.summary = summarizeRecords(rows, now);
      cache = { at: now, body };
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
