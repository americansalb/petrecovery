import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// Role hierarchy for promotion/demotion validation
const ROLE_HIERARCHY = {
  FOUNDER: 4,
  LEADER: 3,
  COORDINATOR: 2,
  MEMBER: 1,
};

const VALID_ROLES = ['MEMBER', 'COORDINATOR', 'LEADER'];

// PATCH /api/rescue-forces/[id]/members/[memberId] - Update member role
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId, memberId } = params;
    const body = await request.json();
    const { role, divisionId } = body;

    // Validate role if provided
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be MEMBER, COORDINATOR, or LEADER' },
        { status: 400 }
      );
    }

    // Get the requesting user's membership
    const requesterMembership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!requesterMembership) {
      return NextResponse.json(
        { error: 'You are not a member of this rescue force' },
        { status: 403 }
      );
    }

    // Only FOUNDER and LEADER can manage members
    if (!['FOUNDER', 'LEADER'].includes(requesterMembership.role)) {
      return NextResponse.json(
        { error: 'Only founders and leaders can manage members' },
        { status: 403 }
      );
    }

    // Get the target member
    const targetMember = await prisma.rescueForceMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!targetMember || targetMember.rescueSquadId !== squadId) {
      return NextResponse.json(
        { error: 'Member not found in this rescue force' },
        { status: 404 }
      );
    }

    // Cannot modify FOUNDER role
    if (targetMember.role === 'FOUNDER') {
      return NextResponse.json(
        { error: 'Cannot modify the founder\'s role' },
        { status: 403 }
      );
    }

    // Leaders cannot promote others to LEADER (only FOUNDER can)
    if (role === 'LEADER' && requesterMembership.role !== 'FOUNDER') {
      return NextResponse.json(
        { error: 'Only the founder can promote members to leader' },
        { status: 403 }
      );
    }

    // Validate division if provided
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
          { error: 'Division not found in this rescue force' },
          { status: 404 }
        );
      }
    }

    // Update the member
    const updateData = {};
    if (role) updateData.role = role;
    if (divisionId !== undefined) updateData.divisionId = divisionId || null;

    const updatedMember = await prisma.rescueForceMember.update({
      where: { id: memberId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            rescueLevel: true,
          },
        },
        division: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log the action
    await prisma.eventLog.create({
      data: {
        event_type: 'squad.member_updated',
        correlation_id: crypto.randomUUID(),
        actor_user_id: session.user.id,
        actor_role: requesterMembership.role,
        resource_type: 'rescue_squad_member',
        resource_id: memberId,
        action: 'update',
        result: 'success',
        metadata: JSON.stringify({
          squadId,
          targetUserId: targetMember.userId,
          changes: updateData,
          previousRole: targetMember.role,
        }),
      },
    });

    return NextResponse.json({
      member: {
        id: updatedMember.id,
        role: updatedMember.role,
        division: updatedMember.division,
        user: updatedMember.user,
        joinedAt: updatedMember.joinedAt,
        casesParticipated: updatedMember.casesParticipated,
        searchHours: updatedMember.searchHours,
        areasMarked: updatedMember.areasMarked,
      },
    });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// DELETE /api/rescue-forces/[id]/members/[memberId] - Remove member from squad
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId, memberId } = params;

    // Get the requesting user's membership
    const requesterMembership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!requesterMembership) {
      return NextResponse.json(
        { error: 'You are not a member of this rescue force' },
        { status: 403 }
      );
    }

    // Only FOUNDER and LEADER can remove members
    if (!['FOUNDER', 'LEADER'].includes(requesterMembership.role)) {
      return NextResponse.json(
        { error: 'Only founders and leaders can remove members' },
        { status: 403 }
      );
    }

    // Get the target member
    const targetMember = await prisma.rescueForceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.rescueSquadId !== squadId) {
      return NextResponse.json(
        { error: 'Member not found in this rescue force' },
        { status: 404 }
      );
    }

    // Cannot remove FOUNDER
    if (targetMember.role === 'FOUNDER') {
      return NextResponse.json(
        { error: 'Cannot remove the founder from the rescue force' },
        { status: 403 }
      );
    }

    // Leaders cannot remove other leaders (only FOUNDER can)
    if (targetMember.role === 'LEADER' && requesterMembership.role !== 'FOUNDER') {
      return NextResponse.json(
        { error: 'Only the founder can remove leaders' },
        { status: 403 }
      );
    }

    // Soft delete - mark as inactive
    await prisma.rescueForceMember.update({
      where: { id: memberId },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    // Also opt them out of any active case participations
    const assignments = await prisma.caseAssignment.findMany({
      where: { rescueSquadId: squadId },
      select: { id: true },
    });

    if (assignments.length > 0) {
      await prisma.caseParticipant.updateMany({
        where: {
          assignmentId: { in: assignments.map(a => a.id) },
          userId: targetMember.userId,
          isActive: true,
        },
        data: {
          isActive: false,
          optedOutAt: new Date(),
        },
      });
    }

    // Log the action
    await prisma.eventLog.create({
      data: {
        event_type: 'squad.member_removed',
        correlation_id: crypto.randomUUID(),
        actor_user_id: session.user.id,
        actor_role: requesterMembership.role,
        resource_type: 'rescue_squad_member',
        resource_id: memberId,
        action: 'delete',
        result: 'success',
        metadata: JSON.stringify({
          squadId,
          removedUserId: targetMember.userId,
          previousRole: targetMember.role,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
