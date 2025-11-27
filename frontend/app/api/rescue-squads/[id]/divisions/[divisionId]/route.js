import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

/**
 * GET /api/rescue-squads/:id/divisions/:divisionId
 *
 * Get division details including members.
 * Public endpoint but shows more data to authenticated squad members.
 */
export async function GET(request, { params }) {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_READ, 'division:detail');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { id: squadId, divisionId } = await params;

    // Check authentication (optional for this endpoint)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Fetch division with members
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            description: true,
            centerLatitude: true,
            centerLongitude: true,
            radiusMiles: true
          }
        },
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' }
          ]
        }
      }
    });

    if (!division) {
      await logEvent({
        event_type: 'division.view_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'read',
        result: 'failure',
        error_code: 'NOT_FOUND',
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
        event_type: 'division.view_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'read',
        result: 'failure',
        error_code: 'SQUAD_MISMATCH',
        actor_user_id: userId,
        metadata: { squadId, divisionId, actualSquadId: division.rescueSquadId }
      });

      return NextResponse.json(
        { error: 'Division does not belong to this squad' },
        { status: 400 }
      );
    }

    // Check if inactive
    if (!division.isActive) {
      return NextResponse.json(
        { error: 'This division is no longer active' },
        { status: 400 }
      );
    }

    // Check if current user is a member of this division or squad
    let userMembership = null;
    let isSquadMember = false;
    let isDivisionMember = false;

    if (userId) {
      // Check squad membership
      const squadMembership = await prisma.rescueSquadMember.findFirst({
        where: {
          rescueSquadId: squadId,
          userId: userId,
          isActive: true
        }
      });

      if (squadMembership) {
        isSquadMember = true;
        isDivisionMember = squadMembership.divisionId === divisionId;
        userMembership = {
          id: squadMembership.id,
          role: squadMembership.role,
          divisionId: squadMembership.divisionId,
          joinedAt: squadMembership.joinedAt
        };
      }
    }

    // Build response - filter sensitive data for non-members
    const formattedMembers = division.members.map(member => {
      const base = {
        id: member.id,
        role: member.role,
        joinedAt: member.joinedAt,
        user: {
          id: member.user.id,
          firstName: member.user.firstName,
          lastName: member.user.lastName?.[0] + '.' // Only first initial of last name
        }
      };

      // Squad members can see full names
      if (isSquadMember) {
        base.user.lastName = member.user.lastName;
      }

      return base;
    });

    // Log successful view
    await logEvent({
      event_type: 'division.viewed',
      resource_type: 'division',
      resource_id: divisionId,
      action: 'read',
      result: 'success',
      actor_user_id: userId,
      metadata: {
        squadId,
        divisionId,
        divisionName: division.name,
        isSquadMember,
        isDivisionMember
      }
    });

    return NextResponse.json({
      division: {
        id: division.id,
        name: division.name,
        description: division.description,
        isActive: division.isActive,
        centerLatitude: division.centerLatitude,
        centerLongitude: division.centerLongitude,
        boundaries: division.boundaries,
        createdAt: division.createdAt,
        updatedAt: division.updatedAt,
        totalMembers: division.members.length,
        members: formattedMembers
      },
      squad: division.rescueSquad,
      userMembership,
      isSquadMember,
      isDivisionMember
    });

  } catch (error) {
    const { id: squadId, divisionId } = await params;

    try {
      await logEvent({
        event_type: 'division.view_failed',
        resource_type: 'division',
        resource_id: divisionId,
        action: 'read',
        result: 'failure',
        error_code: 'INTERNAL_ERROR',
        error_message: error.message,
        metadata: { squadId, divisionId }
      });
    } catch (logError) {
      console.error('Failed to log division view error:', logError);
    }

    console.error('Error fetching division:', error);
    return NextResponse.json(
      { error: 'Failed to load division' },
      { status: 500 }
    );
  }
}
