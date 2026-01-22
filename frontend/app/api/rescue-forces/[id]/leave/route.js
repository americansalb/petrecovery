import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// POST /api/rescue-forces/[id]/leave - Leave a rescue force
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      await logEvent({
        event_type: 'force.leave_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'leave',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to leave force without authentication',
        metadata: { force_id: params.id }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if user is a member
    const membership = await prisma.rescueForceMember.findUnique({
      where: {
        rescueForceId_userId: {
          rescueForceId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      await logEvent({
        event_type: 'force.leave_failed',
        resource_type: 'rescue_squad',
        resource_id: id,
        action: 'leave',
        result: 'failure',
        error_code: 'NOT_MEMBER',
        error_message: 'User is not an active member of this force',
        actor_user_id: session.user.id,
        actor_role: session.user.role,
        metadata: { force_id: id }
      });
      return NextResponse.json(
        { error: 'You are not a member of this force' },
        { status: 400 }
      );
    }

    // Check if user is the founder
    if (membership.role === 'FOUNDER') {
      // Check if there are other leaders
      const otherLeaders = await prisma.rescueForceMember.count({
        where: {
          rescueForceId: id,
          role: 'LEADER',
          isActive: true,
        },
      });

      if (otherLeaders === 0) {
        await logEvent({
          event_type: 'force.leave_failed',
          resource_type: 'rescue_squad',
          resource_id: id,
          action: 'leave',
          result: 'failure',
          error_code: 'FOUNDER_NO_SUCCESSOR',
          error_message: 'Founder cannot leave without promoting another leader',
          actor_user_id: session.user.id,
          actor_role: session.user.role,
          metadata: { force_id: id, user_role: membership.role }
        });
        return NextResponse.json(
          {
            error:
              'As the founder, you must promote another member to leader before leaving',
          },
          { status: 400 }
        );
      }
    }

    // Mark as inactive
    await prisma.rescueForceMember.update({
      where: { id: membership.id },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    // Opt out of all active case participations
    const activeMissions = await prisma.caseParticipant.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        assignment: {
          rescueForceId: id,
          status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] },
        },
      },
    });

    for (const participation of activeMissions) {
      await prisma.caseParticipant.update({
        where: { id: participation.id },
        data: {
          isActive: false,
          optedOutAt: new Date(),
        },
      });
    }

    await logEvent({
      event_type: 'force.left',
      resource_type: 'rescue_squad',
      resource_id: id,
      action: 'leave',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role,
      metadata: {
        force_id: id,
        previous_role: membership.role,
        cases_opted_out: activeMissions.length
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await logEvent({
      event_type: 'force.leave_failed',
      resource_type: 'rescue_squad',
      resource_id: params.id,
      action: 'leave',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || null,
      metadata: {
        force_id: params.id,
        error_name: error.name,
        error_stack: error.stack?.substring(0, 500)
      }
    });
    return NextResponse.json(
      { error: 'Failed to leave force' },
      { status: 500 }
    );
  }
}
