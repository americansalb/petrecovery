/**
 * Impact Feed API
 * Shows volunteers their contribution and its effect
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  getImpactSummary,
  getCaseImpact,
  getOwnerThankYou,
  createOwnerThankYou,
} from '@/app/lib/volunteer/impact';

export async function GET(request) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    if (missionId) {
      // Get case-specific impact
      const impact = await getCaseImpact(missionId, session.user.id);

      if (!impact.success) {
        return NextResponse.json(
          { error: impact.error },
          { status: 404 }
        );
      }

      // Include any thank you message
      const thankYou = await getOwnerThankYou(missionId, session.user.id);

      return NextResponse.json({
        ...impact,
        thankYou,
      });
    }

    // Get overall impact summary
    const result = await getImpactSummary(session.user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Impact feed error:', error);
    return NextResponse.json(
      { error: 'Failed to get impact data' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { missionId, message, photoUrl, recipientId } = body;

    if (!missionId || !message) {
      return NextResponse.json(
        { error: 'Case ID and message required' },
        { status: 400 }
      );
    }

    const result = await createOwnerThankYou(missionId, session.user.id, {
      message,
      photoUrl,
      recipientId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Create thank you error:', error);
    return NextResponse.json(
      { error: 'Failed to create thank you' },
      { status: 500 }
    );
  }
}
