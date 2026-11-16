/**
 * GET /api/owner/open-search
 *
 * The lost-pet search this browser already has open, for someone not signed
 * in: { open: { caseNumber, petName, url } } or { open: null }.
 *
 * Someone not signed in can have one search open at a time, counted by the
 * owner's key the browser kept when it sent the report (app/lib/ownerKey.js).
 * The report form used to learn that only when Post was refused, after all
 * its screens; it asks here first, and tells the person before the first
 * question, with the link to the search they already have.
 *
 * It reads only this browser's own keys, so it says nothing about anyone
 * else, and nothing at all to a request that carries no key. Someone signed
 * in is answered { open: null }: their limit is by account, at Post.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { openSearchesMadeHere } from '@/app/lib/ownerKey';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const noStore = { headers: { 'Cache-Control': 'no-store' } };
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (session?.user) return NextResponse.json({ open: null }, noStore);
    const [mine] = await openSearchesMadeHere(request);
    if (!mine) return NextResponse.json({ open: null }, noStore);
    return NextResponse.json(
      {
        open: {
          caseNumber: mine.caseNumber,
          petName: mine.petName,
          // The same place the refusal at Post sends them: their own search, where they are the owner.
          url: `/mission-control?mission=${encodeURIComponent(mine.caseNumber)}`,
        },
      },
      noStore
    );
  } catch (error) {
    console.error('Open search check failed:', error);
    // The form goes on; Post still checks.
    return NextResponse.json({ open: null }, noStore);
  }
}
