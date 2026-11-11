/**
 * POST /api/mission/[missionId]/answer
 *
 * The owner's answer to a sighting, which the witness's screen shows back
 * to them and the helpers' screens act on. Body: { sightingId, action }.
 *
 *   seen     the owner has opened the sighting
 *   going    the owner is on the way ({ etaMinutes } when known)
 *   hold     the owner asks the helpers to stay back while they go
 *   release  the owner ends that ask
 *
 * Holding people back is the owner's choice and nobody else's (founder
 * rule, 2026-11-11): the product never asks a helper to stop on its own.
 * So `hold` exists only here, is off until the owner turns it on, and
 * goes out in the owner's name. The forces looking for the pet may answer
 * for the owner, since a lead often runs the search; an ask a lead sends
 * goes out under the lead's own first name.
 */
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { searcherFor } from '@/app/lib/searcher';
import { broadcast } from '@/app/lib/sse/missionStream';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const ACTIONS = ['seen', 'going', 'hold', 'release'];

export async function POST(request, { params }) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.API, 'answer');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const body = await request.json().catch(() => ({}));
    const { sightingId, action } = body;
    if (!sightingId || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Send a sightingId and one of: ${ACTIONS.join(', ')}.` }, { status: 400 });
    }
    const pet = await prisma.case.findFirst({ where: missionWhere(params.missionId), select: { id: true } });
    if (!pet) return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    const searcher = await searcherFor(request, pet.id);
    if (!searcher || !(searcher.isOwner || searcher.seesNames)) {
      return NextResponse.json({ error: 'Only the owner and the people running the search can answer a sighting.' }, { status: 403 });
    }
    const sighting = await prisma.caseSighting.findFirst({ where: { id: String(sightingId), missionId: pet.id }, select: { id: true, ownerSeenAt: true } });
    if (!sighting) return NextResponse.json({ error: 'That sighting is not on this search.' }, { status: 404 });

    const now = new Date();
    const data = {};
    if (!sighting.ownerSeenAt) data.ownerSeenAt = now;
    if (action === 'going') {
      const eta = Math.round(Number(body.etaMinutes));
      data.ownerGoingAt = now;
      data.ownerEtaMinutes = Number.isFinite(eta) && eta >= 1 && eta <= 180 ? eta : null;
    } else if (action === 'hold') {
      data.holdAskedAt = now;
      data.holdEndedAt = null;
      // In the name of whoever sent it: null for the owner, whose name the search already carries.
      data.holdAskedByName = searcher.isOwner ? null : searcher.firstName || null;
    } else if (action === 'release') {
      data.holdEndedAt = now;
    }
    const updated = Object.keys(data).length
      ? await prisma.caseSighting.update({
          where: { id: sighting.id },
          data,
          select: { id: true, ownerSeenAt: true, ownerGoingAt: true, ownerEtaMinutes: true, holdAskedAt: true, holdEndedAt: true },
        })
      : await prisma.caseSighting.findUnique({
          where: { id: sighting.id },
          select: { id: true, ownerSeenAt: true, ownerGoingAt: true, ownerEtaMinutes: true, holdAskedAt: true, holdEndedAt: true },
        });

    try {
      broadcast(pet.id, { type: 'SIGHTING_UPDATED', sighting: { id: updated.id, ownerGoing: Boolean(updated.ownerGoingAt), hold: Boolean(updated.holdAskedAt && !updated.holdEndedAt) } });
    } catch (error) {
      console.warn('Answer broadcast failed:', error?.message);
    }
    if (action !== 'seen') {
      await logEvent({
        event_type: `sighting.owner_${action}`,
        actor_user_id: searcher.userId,
        resource_type: 'case_sighting',
        resource_id: updated.id,
        action: 'update',
        result: 'success',
        metadata: { caseId: pet.id, byOwner: searcher.isOwner },
      }).catch(() => {});
    }
    return NextResponse.json({
      sighting: {
        id: updated.id,
        ownerSeenAt: updated.ownerSeenAt,
        ownerGoingAt: updated.ownerGoingAt,
        etaMinutes: updated.ownerEtaMinutes,
        hold: Boolean(updated.holdAskedAt && !updated.holdEndedAt),
      },
    });
  } catch (error) {
    console.error('Sighting answer failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
