/**
 * POST /api/rescue-forces/[id]/duty  { hours: 12 }  or  { hours: 0 }
 *
 * A member goes on duty for the next hours, or off duty (app/lib/duty.js).
 * On duty, a sighting of one of the force's pets, a block that frees up
 * and a need that fits wake their phone; off duty, only the bell and the
 * digest. Members only.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { setDuty, DUTY_HOURS } from '@/app/lib/duty';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const hours = body.hours === undefined ? DUTY_HOURS.default : Number(body.hours);
  if (!Number.isFinite(hours) || hours < 0) {
    return NextResponse.json({ error: 'Say how many hours, or 0 to go off duty.' }, { status: 400 });
  }

  try {
    const result = await setDuty({ forceId: id, userId, hours });
    if (!result) return NextResponse.json({ error: 'Join this Rescue Force to go on duty.' }, { status: 403 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Duty change failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
