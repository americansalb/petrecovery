/**
 * POST /api/mission/[missionId]/answer
 *
 * The owner's answer to a sighting, which the screen of whoever sent it
 * shows back to them. Body: { sightingId, action }.
 *
 *   seen     the owner has opened the sighting
 *   going    the owner is on the way ({ etaMinutes } when known)
 *
 * Both are the owner's alone. The witness reads them as "Avery has seen
 * it" and "Avery is on the way", and nobody else can make a screen say
 * that. Nothing here asks a helper to stop or stay back: the product
 * never does (founder rule, 2026-11-11), and an owner who wants to say
 * something to everyone writes it from the pet's page in their own words.
 */
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { searcherFor } from '@/app/lib/searcher';
import { broadcast } from '@/app/lib/sse/missionStream';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const ACTIONS = ['seen', 'going'];
const ANSWER = { id: true, ownerSeenAt: true, ownerGoingAt: true, ownerEtaMinutes: true };

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
    if (!searcher?.isOwner) return NextResponse.json({ error: 'Only the owner can answer a sighting.' }, { status: 403 });
    const sighting = await prisma.caseSighting.findFirst({ where: { id: String(sightingId), missionId: pet.id }, select: { id: true, ownerSeenAt: true } });
    if (!sighting) return NextResponse.json({ error: 'That sighting is not on this search.' }, { status: 404 });

    const now = new Date();
    const data = {};
    if (!sighting.ownerSeenAt) data.ownerSeenAt = now;
    if (action === 'going') {
      const eta = Math.round(Number(body.etaMinutes));
      data.ownerGoingAt = now;
      data.ownerEtaMinutes = Number.isFinite(eta) && eta >= 1 && eta <= 180 ? eta : null;
    }
    const updated = Object.keys(data).length
      ? await prisma.caseSighting.update({ where: { id: sighting.id }, data, select: ANSWER })
      : await prisma.caseSighting.findUnique({ where: { id: sighting.id }, select: ANSWER });

    try {
      broadcast(pet.id, { type: 'SIGHTING_UPDATED', sighting: { id: updated.id, ownerGoing: Boolean(updated.ownerGoingAt) } });
    } catch (error) {
      console.warn('Answer broadcast failed:', error?.message);
    }
    if (action === 'going') {
      await logEvent({
        event_type: 'sighting.owner_going',
        actor_user_id: searcher.userId,
        resource_type: 'case_sighting',
        resource_id: updated.id,
        action: 'update',
        result: 'success',
        metadata: { caseId: pet.id },
      }).catch(() => {});
    }
    return NextResponse.json({
      sighting: { id: updated.id, ownerSeenAt: updated.ownerSeenAt, ownerGoingAt: updated.ownerGoingAt, etaMinutes: updated.ownerEtaMinutes },
    });
  } catch (error) {
    console.error('Sighting answer failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
