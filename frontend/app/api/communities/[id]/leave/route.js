import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import crypto from 'crypto';

// POST /api/communities/:id/leave - Leave community
export async function POST(request, { params }) {
  const correlationId = crypto.randomUUID();

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get the membership
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: id,
          userId: session.user.id
        }
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 404 }
      );
    }

    if (membership.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'You are not an active member of this community' },
        { status: 400 }
      );
    }

    // Get community name for response
    const community = await prisma.community.findUnique({
      where: { id },
      select: { name: true }
    });

    // Delete the membership
    await prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId: id,
          userId: session.user.id
        }
      }
    });

    // Note: Rescue squads are independent of communities (geographically-based).
    // Squad memberships are not affected by community membership changes.

    await logEvent({
      event_type: 'community.member_left',
      correlation_id: correlationId,
      resource_type: 'community',
      resource_id: id,
      actor_user_id: session.user.id,
      action: 'delete',
      result: 'success',
      metadata: {
        communityName: community?.name,
        membershipId: membership.id
      }
    });

    return NextResponse.json({
      success: true,
      message: `Left ${community?.name || 'community'}`
    });

  } catch (error) {
    await logEvent({
      event_type: 'community.leave_failed',
      correlation_id: correlationId,
      resource_type: 'community',
      action: 'delete',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message
    });

    return NextResponse.json(
      { error: 'Failed to leave community' },
      { status: 500 }
    );
  }
}
