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
 * Holding people back is the owner's or the lead's choice and nobody
 * else's (founder rule, 2026-11-11): the product never asks a helper to
 * stop on its own. So `hold` exists only here, is off until a person
 * turns it on, and goes out in that person's name: the owner's, or the
 * first name of someone with a command role in a force looking for the
 * pet. Joining a force takes one tap, so being a member is not enough.
 *
 * `seen` and `going` are the owner's alone. The witness's screen reads
 * them as "Avery has seen your report" and "Avery is coming", and nobody
 * else can make it say that.
 *
 * The ask stands until whoever may send it ends it, its sighting is an
 * hour old or was taken back, or the search closes (app/lib/searchPicture.js).
 * A newer sighting does not end it, so `release` ends every ask that is
 * still standing for the pet, not only the one on the sighting named.
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
    const ownersAnswer = action === 'seen' || action === 'going';
    if (!searcher || !(ownersAnswer ? searcher.isOwner : searcher.leads)) {
      return NextResponse.json(
        { error: ownersAnswer ? 'Only the owner can answer a sighting.' : 'Only the owner and the people leading the search can ask the helpers to stay back.' },
        { status: 403 }
      );
    }
    const sighting = await prisma.caseSighting.findFirst({
      where: { id: String(sightingId), missionId: pet.id },
      select: { id: true, ownerSeenAt: true, holdAskedAt: true, holdEndedAt: true, holdAskedByName: true },
    });
    if (!sighting) return NextResponse.json({ error: 'That sighting is not on this search.' }, { status: 404 });
    // An ask standing on this sighting, and whether it is the owner's own (the owner's carries no other name).
    const standing = Boolean(sighting.holdAskedAt && !sighting.holdEndedAt);
    const ownersAsk = standing && !sighting.holdAskedByName;
    if (action === 'release' && ownersAsk && !searcher.isOwner) {
      return NextResponse.json({ error: 'The owner sent that ask. Only the owner can end it.' }, { status: 403 });
    }

    const now = new Date();
    const data = {};
    // Opening it is the owner's to record. A lead sending an ask has not seen it for the owner.
    if (searcher.isOwner && !sighting.ownerSeenAt) data.ownerSeenAt = now;
    if (action === 'going') {
      const eta = Math.round(Number(body.etaMinutes));
      data.ownerGoingAt = now;
      data.ownerEtaMinutes = Number.isFinite(eta) && eta >= 1 && eta <= 180 ? eta : null;
    } else if (action === 'hold') {
      // An ask that already stands here keeps the name it went out under.
      if (!standing) {
        data.holdAskedAt = now;
        data.holdEndedAt = null;
        // In the name of whoever sent it: null for the owner, whose name the search already carries.
        data.holdAskedByName = searcher.isOwner ? null : searcher.firstName || null;
      }
    } else if (action === 'release') {
      if (standing) data.holdEndedAt = now;
      // Every other ask still standing for this pet ends with it. The owner ends them all;
      // someone leading the search ends the ones leads sent, and never the owner's own.
      await prisma.caseSighting.updateMany({
        where: {
          missionId: pet.id,
          holdAskedAt: { not: null },
          holdEndedAt: null,
          NOT: { id: sighting.id },
          ...(searcher.isOwner ? {} : { holdAskedByName: { not: null } }),
        },
        data: { holdEndedAt: now },
      });
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
