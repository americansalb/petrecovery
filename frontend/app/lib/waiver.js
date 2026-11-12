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
import { getClientIP } from '@/app/lib/rateLimit';
import { WAIVER_VERSION, waiverIsCurrent } from '@/app/lib/waiverVersion';

export { WAIVER_VERSION, waiverIsCurrent };

export const WAIVER_CODE = 'WAIVER_NOT_ACCEPTED';

/** True when this person may search for this pet: waiver signed, or it is their pet. */
export async function maySearch(userId, caseId) {
  const [user, pet] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { waiverAcceptedAt: true, waiverVersionAccepted: true } }),
    caseId ? prisma.case.findUnique({ where: { id: caseId }, select: { reporterId: true } }) : null,
  ]);
  return waiverIsCurrent(user?.waiverAcceptedAt, user?.waiverVersionAccepted) || (pet != null && pet.reporterId === userId);
}

/** Null when the person may search for the pet; otherwise the 403 to send. */
export async function waiverRefusal(userId, caseId) {
  if (await maySearch(userId, caseId)) return null;
  return NextResponse.json(
    { error: 'Accept the safety waiver before you search.', code: WAIVER_CODE },
    { status: 403 }
  );
}

/** Said when the screen showed a version that is no longer the one in force. */
export const WAIVER_CHANGED_CODE = 'WAIVER_CHANGED';
export const WAIVER_CHANGED_WORDS = 'The waiver was updated while this page was open. Reload the page, read it again and tick the box.';

/** Whether the version a screen says it showed is one that cannot be agreed to: it showed one, and not this one. */
export const shownAnOldWaiver = (shownVersion) => Boolean(shownVersion) && String(shownVersion) !== WAIVER_VERSION;

const clip = (text, max) => (text == null ? null : String(text).slice(0, max) || null);

/**
 * Keep the proof of an agreement: one WaiverAcceptance row with who, which
 * version, when and from where. Never throws: someone who agreed is not
 * turned away because the proof could not be written, and the acceptance
 * itself is already on their own row.
 */
export async function recordWaiver({ request = null, userId = null, volunteerId = null, caseId = null, name = null, shownVersion = null, adult = false } = {}) {
  try {
    let ipAddress = null;
    try {
      ipAddress = request ? clip(getClientIP(request), 64) : null;
    } catch {
      ipAddress = null;
    }
    return await prisma.waiverAcceptance.create({
      data: {
        userId: userId || null,
        volunteerId: volunteerId || null,
        caseId: caseId || null,
        name: clip(name, 60),
        version: WAIVER_VERSION,
        shownVersion: clip(shownVersion, 20),
        adult: Boolean(adult),
        ipAddress: ipAddress === 'unknown' ? null : ipAddress,
        userAgent: clip(request?.headers?.get?.('user-agent'), 300),
      },
      select: { id: true },
    });
  } catch (error) {
    console.error('[waiver] the record of an acceptance was not written:', error?.message);
    return null;
  }
}

/** Stamp the latest acceptance of this person as trained. Resolves to whether a row was stamped. */
export async function recordTrained({ userId = null, volunteerId = null } = {}) {
  if (!userId && !volunteerId) return false;
  try {
    const last = await prisma.waiverAcceptance.findFirst({
      where: userId ? { userId } : { volunteerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, trainedAt: true },
    });
    if (!last) return false;
    if (!last.trainedAt) await prisma.waiverAcceptance.update({ where: { id: last.id }, data: { trainedAt: new Date() } });
    return true;
  } catch {
    return false;
  }
}
