/**
 * GET /api/owner/open-search
 *
 * The lost-pet search this browser already has open, for someone not signed
 * in: { open: { caseNumber, petName, url, hasEmail } } or { open: null }.
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
 *
 * `hasEmail` says whether the account the search was filed to has an
 * address mail can go to (app/lib/placeholderEmail.js), never the address:
 * the notice offers setting a password by email only to someone who gave
 * one. A phone-only guest's account has a placeholder address.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { openSearchesMadeHere } from '@/app/lib/ownerKey';
import { isDeliverableEmail } from '@/app/lib/placeholderEmail';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const noStore = { headers: { 'Cache-Control': 'no-store' } };
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (session?.user) return NextResponse.json({ open: null }, noStore);
    const [mine] = await openSearchesMadeHere(request);
    if (!mine) return NextResponse.json({ open: null }, noStore);
    const filedTo = await prisma.case
      .findUnique({ where: { id: mine.id }, select: { reporter: { select: { email: true } } } })
      .catch(() => null);
    return NextResponse.json(
      {
        open: {
          caseNumber: mine.caseNumber,
          petName: mine.petName,
          // The same place the refusal at Post sends them: their own search, where they are the owner.
          url: `/mission-control?mission=${encodeURIComponent(mine.caseNumber)}`,
          hasEmail: isDeliverableEmail(filedTo?.reporter?.email),
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
