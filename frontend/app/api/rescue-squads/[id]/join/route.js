import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// POST /api/rescue-squads/:id/join - Join a rescue squad
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      await logEvent({
        event_type: 'squad.join_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to join squad without authentication',
        metadata: { squadId: params.id }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Emit squad.join_attempted event
    await logEvent({
      event_type: 'squad.join_attempted',
      resource_type: 'rescue_squad',
      resource_id: params.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: { squadId: params.id }
    });

    // Check waiver acceptance (Phase 0: Legal Baseline)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        waiverAcceptedAt: true,
        waiverVersionAccepted: true
      }
    });

    if (!user?.waiverAcceptedAt) {
      // Emit both legal.blocked_action AND squad.join_failed for admin visibility
      await logEvent({
        event_type: 'legal.blocked_action',
        resource_type: 'squad',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to join squad without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: {
          blocked_action: 'squad_join',
          squad_id: params.id
        }
      });

      await logEvent({
        event_type: 'squad.join_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'Squad join blocked - liability waiver not accepted',
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { squadId: params.id }
      });

      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before joining a rescue squad. Rescue squad participation involves physical risks.',
        redirectTo: `/legal/consent?returnUrl=${encodeURIComponent(`/rescue-squads/${params.id}`)}`
      }, { status: 403 });
    }

    const squad = await prisma.rescueSquad.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        isAcceptingCases: true,
        _count: { select: { members: true } }
      }
    });

    if (!squad) {
      await logEvent({
        event_type: 'squad.join_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'SQUAD_NOT_FOUND',
        error_message: `Squad ${params.id} not found`,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { squadId: params.id }
      });
      return NextResponse.json(
        { error: 'Rescue squad not found' },
        { status: 404 }
      );
    }

    // ⭐ FIXED: Schema has 'isAcceptingCases' not 'isAcceptingMembers'
    if (!squad.isAcceptingCases) {
      await logEvent({
        event_type: 'squad.join_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'NOT_ACCEPTING_MEMBERS',
        error_message: `Squad ${squad.name} is not currently accepting new members`,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: {
          squadId: params.id,
          squadName: squad.name,
          city: squad.city,
          state: squad.state
        }
      });
      return NextResponse.json(
        { error: 'This rescue squad is not currently accepting new members' },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMembership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: params.id,
        userId: session.user.id,
      },
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        await logEvent({
          event_type: 'squad.join_failed',
          resource_type: 'rescue_squad',
          resource_id: params.id,
          action: 'update',
          result: 'failure',
          error_code: 'ALREADY_MEMBER',
          error_message: `User is already an active member of squad ${squad.name}`,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: {
            squadId: params.id,
            squadName: squad.name,
            membershipId: existingMembership.id,
            membershipRole: existingMembership.role
          }
        });
        return NextResponse.json(
          { error: 'You are already a member of this squad' },
          { status: 400 }
        );
      } else {
        // Re-activate existing membership
        await prisma.rescueSquadMember.update({
          where: { id: existingMembership.id },
          data: {
            isActive: true,
            joinedAt: new Date(),
          },
        });

        // Log successful rejoin
        await logEvent({
          event_type: 'squad.joined',
          resource_type: 'rescue_squad',
          resource_id: params.id,
          action: 'update',
          result: 'success',
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: {
            squadId: params.id,
            squadName: squad.name,
            city: squad.city,
            state: squad.state,
            membershipId: existingMembership.id,
            membershipRole: existingMembership.role,
            isRejoin: true,
            currentMemberCount: squad._count.members
          }
        });

        return NextResponse.json({
          message: 'Successfully rejoined the squad',
        });
      }
    }

    // Create new membership
    const membership = await prisma.rescueSquadMember.create({
      data: {
        rescueSquadId: params.id,
        userId: session.user.id,
        role: 'MEMBER',
        isActive: true,
      },
    });

    // Update user's squad count
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        squadsJoinedCount: { increment: 1 },
      },
    });

    // Log successful join
    await logEvent({
      event_type: 'squad.joined',
      resource_type: 'rescue_squad',
      resource_id: params.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        squadId: params.id,
        squadName: squad.name,
        city: squad.city,
        state: squad.state,
        membershipId: membership.id,
        newMemberRole: 'MEMBER',
        isRejoin: false,
        previousMemberCount: squad._count.members,
        newMemberCount: squad._count.members + 1
      }
    });

    return NextResponse.json({
      message: 'Successfully joined the squad',
    });
  } catch (error) {
    // Try to log the failure event (best effort - don't re-throw if logging fails)
    try {
      await logEvent({
        event_type: 'squad.join_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'DB_WRITE_FAILED',
        error_message: error.message || 'Unknown error during squad join',
        metadata: {
          squadId: params.id,
          errorName: error.name,
          errorStack: error.stack?.split('\n')[0] // First line of stack trace
        }
      });
    } catch (logError) {
      console.error('Failed to log squad.join_failed event:', logError);
    }

    console.error('Error joining rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to join rescue squad' },
      { status: 500 }
    );
  }
}
