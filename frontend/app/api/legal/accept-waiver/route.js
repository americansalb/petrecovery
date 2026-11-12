/**
 * POST /api/legal/accept-waiver
 *
 * Someone signed in agrees to the liability waiver. What is kept:
 *
 *  - on their account, when they agreed and to which version. The version
 *    is the one in force (app/lib/waiverVersion.js), never a constant
 *    typed here: until 2026-11-12 this wrote "1.0" whatever text the
 *    person had been shown, so the record could not say what they agreed
 *    to.
 *  - a WaiverAcceptance row: the proof, with the address and browser it
 *    came from (app/lib/waiver.js).
 *
 * A body is optional: { version, adult, caseId }. `version` is the one
 * the screen showed; if it is not the one in force the answer is 409 and
 * nothing is recorded, because nobody can agree to a text they were not
 * shown.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { WAIVER_VERSION, WAIVER_CHANGED_CODE, WAIVER_CHANGED_WORDS, shownAnOldWaiver, recordWaiver } from '@/app/lib/waiver';

export async function POST(request) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be logged in to accept the waiver' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const shownVersion = typeof body?.version === 'string' ? body.version : null;
    if (shownAnOldWaiver(shownVersion)) {
      return NextResponse.json({ error: WAIVER_CHANGED_WORDS, code: WAIVER_CHANGED_CODE, version: WAIVER_VERSION }, { status: 409 });
    }

    const now = new Date();
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        waiverAcceptedAt: now,
        waiverVersionAccepted: WAIVER_VERSION,
        tosAcceptedAt: now, // Also accept ToS
        tosVersionAccepted: '1.0',
      },
      select: { firstName: true },
    });
    await recordWaiver({
      request,
      userId: session.user.id,
      caseId: typeof body?.caseId === 'string' ? body.caseId.slice(0, 40) : null,
      name: user?.firstName || null,
      shownVersion,
      adult: Boolean(body?.adult),
    });

    logEvent({
      event_type: 'legal.waiver_accepted',
      resource_type: 'legal_document',
      action: 'create',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role,
      metadata: { acceptance_timestamp: now.toISOString(), waiver_version: WAIVER_VERSION },
    });

    return NextResponse.json({ success: true, message: 'Waiver accepted successfully', acceptedAt: now.toISOString(), version: WAIVER_VERSION });
  } catch (error) {
    console.error('[Waiver Accept] Error:', error?.message);
    logEvent({
      event_type: 'legal.waiver_accept_failed',
      resource_type: 'legal_document',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error?.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || null,
    });
    return NextResponse.json({ error: 'Failed to accept waiver' }, { status: 500 });
  }
}
