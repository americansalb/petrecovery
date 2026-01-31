/**
 * POST /api/volunteer/join
 * One-tap volunteer join - no signup wall
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { quickJoinCase, getVolunteerStatus } from '@/app/lib/volunteer/quickJoin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { missionId, location, deviceId, name, phone } = body;

    if (!missionId) {
      return NextResponse.json(
        { error: 'Case ID required' },
        { status: 400 }
      );
    }

    // Get user session if logged in
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const result = await quickJoinCase(missionId, {
      userId,
      deviceId,
      location,
      name,
      phone,
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
