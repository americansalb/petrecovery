import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// PATCH /api/rescue-squads/[id]/my-division - Update current user's division assignment
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;
    const body = await request.json();
    const { divisionId } = body;

    // Get user's membership in this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
      include: {
        division: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this force' },
        { status: 403 }
      );
    }

    // If setting a division, validate it exists and belongs to this squad
    if (divisionId) {
      const division = await prisma.division.findFirst({
        where: {
          id: divisionId,
          rescueSquadId: squadId,
          isActive: true,
          isDeleted: false,
        },
      });

      if (!division) {
        return NextResponse.json(
          { error: 'Division not found in this force' },
          { status: 404 }
        );
      }
    }

    const previousDivisionId = membership.divisionId;
    const previousDivisionName = membership.division?.name;

    // Update the member's division
    const updatedMembership = await prisma.rescueSquadMember.update({
      where: { id: membership.id },
      data: {
        divisionId: divisionId || null,
      },
      include: {
        division: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        rescueSquad: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update division member counts if division changed
    if (previousDivisionId !== divisionId) {
      // Decrement old division count
      if (previousDivisionId) {
        await prisma.division.update({
          where: { id: previousDivisionId },
          data: {
            totalMembers: { decrement: 1 },
          },
        });
      }

      // Increment new division count
      if (divisionId) {
        await prisma.division.update({
          where: { id: divisionId },
          data: {
            totalMembers: { increment: 1 },
          },
        });
      }
    }

    // Log the division change
    await prisma.eventLog.create({
      data: {
        event_type: 'squad.member_division_changed',
        correlation_id: crypto.randomUUID(),
        actor_user_id: session.user.id,
        actor_role: membership.role,
        resource_type: 'rescue_squad_member',
        resource_id: membership.id,
        action: 'update',
        result: 'success',
        metadata: JSON.stringify({
          squadId,
          squadName: updatedMembership.rescueSquad.name,
          previousDivisionId,
          previousDivisionName,
          newDivisionId: divisionId || null,
          newDivisionName: updatedMembership.division?.name || null,
        }),
      },
    });

    return NextResponse.json({
      message: divisionId
        ? `You've joined the ${updatedMembership.division.name} division`
        : 'You\'ve left your division',
      membership: {
        id: updatedMembership.id,
        role: updatedMembership.role,
        division: updatedMembership.division,
      },
    });
  } catch (error) {
    console.error('Error updating member division:', error);
    return NextResponse.json(
      { error: 'Failed to update division assignment' },
      { status: 500 }
    );
  }
}

// GET /api/rescue-squads/[id]/my-division - Get current user's division and available divisions
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;

    // Get user's membership in this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
      include: {
        division: {
          select: {
            id: true,
            name: true,
            description: true,
            totalMembers: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this force' },
        { status: 403 }
      );
    }

    // Get all available divisions in this squad
    const divisions = await prisma.division.findMany({
      where: {
        rescueSquadId: squadId,
        isActive: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        totalMembers: true,
        activeMissions: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      currentDivision: membership.division,
      availableDivisions: divisions,
      membershipId: membership.id,
      role: membership.role,
    });
  } catch (error) {
    console.error('Error fetching division info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch division information' },
      { status: 500 }
    );
  }
}
