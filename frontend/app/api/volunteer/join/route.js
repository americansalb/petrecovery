/**
 * POST /api/volunteer/join
 * One-tap volunteer join, for someone signed in.
 *
 * It used to take no sign-in: a device id or a phone number in the request
 * was the whole of who was asking, so anyone could make guest accounts
 * without limit, add made-up helpers to any open search, or act as an
 * existing guest by sending their phone number. Nothing on the site calls
 * it. Joining from a pet's link with no account is
 * /api/mission/[missionId]/volunteer, which proves a helper by their own
 * key.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { quickJoinCase, getVolunteerStatus } from '@/app/lib/volunteer/quickJoin';
import { cleanPlace } from '@/app/lib/missionControl/guard';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const JOIN_LIMIT = { windowMs: 60 * 1000, maxRequests: 6, blockDurationMs: 60 * 1000 };

export async function POST(request) {
  try {
    const limited = await withRateLimitAsync(request, JOIN_LIMIT, 'volunteer:join');
    if (!limited.success) return rateLimitResponse(limited);

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in to join this search.', code: 'SIGN_IN' }, { status: 401 });
    }

    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};
    const missionId = typeof body.missionId === 'string' ? body.missionId : '';

    if (!missionId) {
      return NextResponse.json(
        { error: 'Case ID required' },
        { status: 400 }
      );
    }

    // The person signed in, and where they are if they said. A device id, a name or a phone number in the
    // request is not who they are, and is not passed on.
    const result = await quickJoinCase(missionId, {
      userId,
      location: cleanPlace(body.location),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Volunteer join error:', error);
    return NextResponse.json(
      { error: 'Failed to join case' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    if (!missionId) {
      return NextResponse.json(
        { error: 'Case ID required' },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ isVolunteering: false });
    }

    const status = await getVolunteerStatus(missionId, session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Volunteer status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
