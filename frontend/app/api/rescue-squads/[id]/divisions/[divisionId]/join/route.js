import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

/**
 * POST /api/rescue-squads/:id/divisions/:divisionId/join
 *
 * Join a specific division within a rescue squad.
 * User must already be a member of the parent squad.
 */
export async function POST(request, { params }) {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.API, 'division:join');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { id: squadId, divisionId } = await params;

    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      await logEvent({
        event_type: 'division.join_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'Attempted to join division without authentication',
        metadata: { squadId, divisionId }
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Log attempt
    await logEvent({
      event_type: 'division.join_attempted',
      resource_type: 'division',
      resource_id: divisionId,
      action: 'update',
      result: 'success',
      actor_user_id: userId,
      metadata: { squadId, divisionId }
    });

    // Check waiver acceptance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        waiverAcceptedAt: true,
        waiverVersionAccepted: true
      }
    });

    if (!user?.waiverAcceptedAt) {
      await logEvent({
        event_type: 'legal.blocked_action',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        actor_user_id: userId,
        metadata: {
          blocked_action: 'division_join',
          squadId,
          divisionId
        }
      });

      return NextResponse.json({
        error: 'Liability waiver required',
        code: 'WAIVER_NOT_ACCEPTED',
        message: 'You must accept the liability waiver before joining a division.',
        redirectTo: `/legal/consent?returnUrl=${encodeURIComponent(`/rescue-squads/${squadId}`)}`
      }, { status: 403 });
    }

    // Verify the division exists and belongs to this squad
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: {
        id: true,
        name: true,
        rescueSquadId: true,
        isActive: true,
        rescueSquad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    if (!division) {
      await logEvent({
        event_type: 'division.join_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'DIVISION_NOT_FOUND',
        actor_user_id: userId,
        metadata: { squadId, divisionId }
      });
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    // Verify division belongs to the specified squad
    if (division.rescueSquadId !== squadId) {
      await logEvent({
        event_type: 'division.join_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'DIVISION_SQUAD_MISMATCH',
        actor_user_id: userId,
        metadata: { squadId, divisionId, actualSquadId: division.rescueSquadId }
      });
      return NextResponse.json(
        { error: 'Division does not belong to this squad' },
        { status: 400 }
      );
    }

    // Check division is active
    if (!division.isActive) {
      await logEvent({
        event_type: 'division.join_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'DIVISION_INACTIVE',
        actor_user_id: userId,
        metadata: { squadId, divisionId, divisionName: division.name }
      });
      return NextResponse.json(
        { error: 'This division is not currently active' },
        { status: 400 }
      );
    }

    // Check user is a member of the parent squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: userId,
        isActive: true
      }
    });

    if (!membership) {
      await logEvent({
        event_type: 'division.join_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'NOT_SQUAD_MEMBER',
        actor_user_id: userId,
        metadata: { squadId, divisionId }
      });
      return NextResponse.json(
        { error: 'You must be a member of the squad before joining a division' },
        { status: 400 }
      );
    }

    // Check if already in this division
    if (membership.divisionId === divisionId) {
      await logEvent({
        event_type: 'division.join_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'ALREADY_IN_DIVISION',
        actor_user_id: userId,
        metadata: { squadId, divisionId, membershipId: membership.id }
      });
      return NextResponse.json(
        { error: 'You are already a member of this division' },
        { status: 400 }
      );
    }

    // Update membership with division
    const previousDivisionId = membership.divisionId;
    await prisma.rescueSquadMember.update({
      where: { id: membership.id },
      data: { divisionId: divisionId }
    });

    // Log successful join
    await logEvent({
      event_type: 'division.joined',
      resource_type: 'division',
      resource_id: divisionId,
      action: 'update',
      result: 'success',
      actor_user_id: userId,
      metadata: {
        squadId,
        squadName: division.rescueSquad.name,
        divisionId,
        divisionName: division.name,
        membershipId: membership.id,
        previousDivisionId: previousDivisionId || null,
        isTransfer: !!previousDivisionId
      }
    });

    return NextResponse.json({
      success: true,
      message: previousDivisionId
        ? `Successfully transferred to ${division.name}`
        : `Successfully joined ${division.name}`,
      division: {
        id: division.id,
        name: division.name
      },
      squad: {
        id: division.rescueSquad.id,
        name: division.rescueSquad.name
      }
    });

  } catch (error) {
    const { id: squadId, divisionId } = await params;

    // Log error
    try {
      await logEvent({
        event_type: 'division.join_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'update',
        result: 'failure',
        error_code: 'INTERNAL_ERROR',
        error_message: error.message,
        metadata: {
          squadId,
          divisionId,
          errorName: error.name
        }
      });
    } catch (logError) {
      console.error('Failed to log division.join_failed event:', logError);
    }

    console.error('Error joining division:', error);
    return NextResponse.json(
      { error: 'Failed to join division' },
      { status: 500 }
    );
  }
}
