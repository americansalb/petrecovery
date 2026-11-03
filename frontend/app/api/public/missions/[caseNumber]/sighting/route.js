/**
 * POST /api/public/missions/[caseNumber]/sighting
 *
 * A witness reports a sighting from the pet's share link, with no account
 * (app/lib/witness.js). Body: { lat, lng, address?, sure: SURE | LIKELY |
 * UNSURE, direction?, name?, note? }. Signed in or not; a session only adds
 * the Discussion post in the witness's name. Rate limited like every public
 * write. 201 with { place, told, caseNumber }, 400 in words, 404, or 409
 * when the search has ended.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { logEvent } from '@/lib/logging';
import { checkWitnessSighting, recordWitnessSighting } from '@/app/lib/witness';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'witness:sighting');
  if (!rl.success) return rateLimitResponse(rl);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Mark where you saw the pet on the map.' }, { status: 400 });
  }
  const checked = checkWitnessSighting(body);
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = session?.user?.id || null;
    const out = await recordWitnessSighting(params.caseNumber, checked.value, { userId });
    if (out.error === 'NOT_FOUND') return NextResponse.json({ error: 'This link does not match a pet.' }, { status: 404 });
    if (out.error === 'CLOSED') return NextResponse.json({ error: 'This search has ended. Thank you for looking.' }, { status: 409 });

    logEvent({
      event_type: 'case.sighting_reported',
      resource_type: 'mission',
      resource_id: out.caseNumber,
      action: 'create',
      result: 'success',
      actor_user_id: userId,
      metadata: { sightingId: out.sighting.id, witness: !userId, sure: checked.value.sure, told: out.told },
    }).catch(() => {});

    return NextResponse.json({ sighting: out.sighting, place: out.place, told: out.told, caseNumber: out.caseNumber, ownerName: out.ownerName }, { status: 201 });
  } catch (error) {
    console.error('[witness] sighting failed:', error);
    return NextResponse.json({ error: 'That did not send. Check your connection and try again.' }, { status: 500 });
  }
}
