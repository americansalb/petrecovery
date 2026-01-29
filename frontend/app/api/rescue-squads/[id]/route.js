import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// GET /api/rescue-squads/:id - Get single rescue squad details
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  try {
    const squad = await prisma.rescueSquad.findUnique({
      where: { id: params.id },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' }, // FOUNDER first, then LEADER, then MEMBER
            { joinedAt: 'asc' },
          ],
        },
        divisions: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            totalMembers: true,
            activeMissions: true,
          },
        },
        _count: {
          select: {
            members: { where: { isActive: true } },
            caseAssignments: true,
          },
        },
      },
    });

    if (!squad) {
      await logEvent({
        event_type: 'squad.detail_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'read',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: `Squad not found: ${params.id}`,
        actor_user_id: session?.user?.id || null,
        actor_role: session?.user?.role || 'anonymous',
        metadata: { squad_id: params.id }
      });
      return NextResponse.json(
        { error: 'Rescue force not found' },
        { status: 404 }
      );
    }

    await logEvent({
      event_type: 'squad.detail_viewed',
      resource_type: 'rescue_squad',
      resource_id: squad.id,
      action: 'read',
      result: 'success',
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'anonymous',
      metadata: {
        squad_id: squad.id,
        squad_name: squad.name,
        squad_city: squad.city,
        squad_state: squad.state,
        member_count: squad._count.members
      }
    });

    return NextResponse.json({ squad });
  } catch (error) {
    await logEvent({
      event_type: 'squad.detail_failed',
      resource_type: 'rescue_squad',
      resource_id: params.id,
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'anonymous',
      metadata: {
        squad_id: params.id,
        error_name: error.name,
        error_stack: error.stack?.substring(0, 500)
      }
    });
    return NextResponse.json(
      { error: 'Failed to fetch rescue force' },
      { status: 500 }
    );
  }
}

// PATCH /api/rescue-squads/:id - Update squad settings (leaders only)
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;
    const body = await request.json();

    // Verify user is a FOUNDER or LEADER of this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only founders and leaders can update squad settings' },
        { status: 403 }
      );
    }

    // Allowed fields to update
    const allowedFields = [
      'description',
      'specializesInDogs',
      'specializesInCats',
      'specializesInBirds',
      'specializesInOther',
      'availableWeekdays',
      'availableWeekends',
      'availableDay',
      'availableNight',
      'hasTrackingDogs',
      'hasDrones',
      'isAcceptingCases',
    ];

    // Build update data with only allowed fields
    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the squad
    const updatedSquad = await prisma.rescueSquad.update({
      where: { id: squadId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        specializesInDogs: true,
        specializesInCats: true,
        specializesInBirds: true,
        specializesInOther: true,
        availableWeekdays: true,
        availableWeekends: true,
        availableDay: true,
        availableNight: true,
        hasTrackingDogs: true,
        hasDrones: true,
        isAcceptingCases: true,
        updatedAt: true,
      },
    });

    // Log the update
    await logEvent({
      event_type: 'squad.settings_updated',
      resource_type: 'rescue_squad',
      resource_id: squadId,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: membership.role,
      metadata: {
        squad_id: squadId,
        updated_fields: Object.keys(updateData),
      },
    });

    return NextResponse.json({ squad: updatedSquad });
  } catch (error) {
    console.error('Error updating squad:', error);
    return NextResponse.json(
      { error: 'Failed to update squad settings' },
      { status: 500 }
    );
  }
}
