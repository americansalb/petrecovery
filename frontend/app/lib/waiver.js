/**
 * The safety waiver. A person signs it once (User.waiverAcceptedAt,
 * POST /api/legal/accept-waiver) before they search for a pet in person.
 *
 * Mission Control opens for anyone signed in, and asks for the waiver at
 * the first thing that takes someone out searching: starting a walk,
 * claiming a block, marking one searched, joining the search. Those routes
 * refuse without it, with WAIVER_CODE, which the page answers by opening
 * the waiver. A pet's owner never needs it to search for their own pet.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const WAIVER_CODE = 'WAIVER_NOT_ACCEPTED';

/** True when this person may search for this pet: waiver signed, or it is their pet. */
export async function maySearch(userId, caseId) {
  const [user, pet] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { waiverAcceptedAt: true } }),
    caseId ? prisma.case.findUnique({ where: { id: caseId }, select: { reporterId: true } }) : null,
  ]);
  return Boolean(user?.waiverAcceptedAt) || (pet != null && pet.reporterId === userId);
}

/** Null when the person may search for the pet; otherwise the 403 to send. */
export async function waiverRefusal(userId, caseId) {
  if (await maySearch(userId, caseId)) return null;
  return NextResponse.json(
    { error: 'Accept the safety waiver before you search.', code: WAIVER_CODE },
    { status: 403 }
  );
}
