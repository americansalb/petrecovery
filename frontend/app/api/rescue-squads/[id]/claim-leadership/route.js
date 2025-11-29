import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// POST /api/rescue-squads/[id]/claim-leadership - Claim leadership of a leaderless squad
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId } = params;

    // Check if user is a member of this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a squad member to claim leadership' },
        { status: 403 }
      );
    }

    // Already a leader?
    if (['FOUNDER', 'LEADER'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'You are already a leader of this squad' },
        { status: 400 }
      );
    }

    // Check if squad has any leaders
    const existingLeaders = await prisma.rescueSquadMember.count({
      where: {
        rescueSquadId: squadId,
        role: { in: ['FOUNDER', 'LEADER'] },
        isActive: true,
      },
    });

    if (existingLeaders > 0) {
      return NextResponse.json(
        { error: 'This squad already has active leadership. Contact them to become a leader.' },
        { status: 400 }
      );
    }

    // Promote user to LEADER
    const updatedMembership = await prisma.rescueSquadMember.update({
      where: { id: membership.id },
      data: { role: 'LEADER' },
    });

    // Log the event
    await logEvent({
      event_type: 'squad.leadership_claimed',
      resource_type: 'rescue_squad',
      resource_id: squadId,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: 'LEADER',
      metadata: {
        squadId,
        previousRole: membership.role,
        newRole: 'LEADER',
        reason: 'leaderless_squad_claim',
      },
    });

    return NextResponse.json({
      message: 'You are now a leader of this squad!',
      role: 'LEADER',
    });
  } catch (error) {
    console.error('Error claiming leadership:', error);
    return NextResponse.json(
      { error: 'Failed to claim leadership' },
      { status: 500 }
    );
  }
}
