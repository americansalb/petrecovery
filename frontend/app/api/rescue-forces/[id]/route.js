import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// GET /api/rescue-forces/:id - Get single rescue force details
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  try {
    const force = await prisma.rescueForce.findUnique({
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

    if (!force) {
      await logEvent({
        event_type: 'force.detail_failed',
        resource_type: 'rescue_squad',
        resource_id: params.id,
        action: 'read',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: `Force not found: ${params.id}`,
        actor_user_id: session?.user?.id || null,
        actor_role: session?.user?.role || 'anonymous',
        metadata: { force_id: params.id }
      });
      return NextResponse.json(
        { error: 'Rescue force not found' },
        { status: 404 }
      );
    }

    await logEvent({
      event_type: 'force.detail_viewed',
      resource_type: 'rescue_squad',
      resource_id: force.id,
      action: 'read',
      result: 'success',
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'anonymous',
      metadata: {
        force_id: force.id,
        force_name: force.name,
        squad_city: force.city,
        squad_state: force.state,
        member_count: force._count.members
      }
    });

    return NextResponse.json({ force });
  } catch (error) {
    await logEvent({
      event_type: 'force.detail_failed',
      resource_type: 'rescue_squad',
      resource_id: params.id,
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'anonymous',
      metadata: {
        force_id: params.id,
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

// PATCH /api/rescue-forces/:id - Update force settings (leaders only)
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const forceId = params.id;
    const body = await request.json();

    // Verify user is a FOUNDER or LEADER of this force
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only founders and leaders can update force settings' },
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

    // Update the force
    const updatedSquad = await prisma.rescueForce.update({
      where: { id: forceId },
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
      event_type: 'force.settings_updated',
      resource_type: 'rescue_squad',
      resource_id: forceId,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: membership.role,
      metadata: {
        force_id: forceId,
        updated_fields: Object.keys(updateData),
      },
    });

    return NextResponse.json({ force: updatedSquad });
  } catch (error) {
    console.error('Error updating force:', error);
    return NextResponse.json(
      { error: 'Failed to update force settings' },
      { status: 500 }
    );
  }
}
