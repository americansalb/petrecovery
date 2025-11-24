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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check waiver acceptance (Phase 0: Legal Baseline)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        waiverAcceptedAt: true,
        waiverVersionAccepted: true
      }
    });

    if (!user?.waiverAcceptedAt) {
      console.log(`⚠️  [Squad Join] User ${session.user.id} blocked - waiver not accepted`);

      logEvent({
        event_type: 'legal.blocked_action',
        resource_type: 'squad',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'WAIVER_NOT_ACCEPTED',
        error_message: 'User attempted to join squad without accepting liability waiver',
        actor_user_id: session.user.id,
        actor_role: session.user.role,
        metadata: {
          blocked_action: 'squad_join',
          squad_id: params.id
        }
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
    });

    if (!squad) {
      return NextResponse.json(
        { error: 'Rescue squad not found' },
        { status: 404 }
      );
    }

    // ⭐ FIXED: Schema has 'isAcceptingCases' not 'isAcceptingMembers'
    if (!squad.isAcceptingCases) {
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

        return NextResponse.json({
          message: 'Successfully rejoined the squad',
        });
      }
    }

    // Create new membership
    await prisma.rescueSquadMember.create({
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

    return NextResponse.json({
      message: 'Successfully joined the squad',
    });
  } catch (error) {
    console.error('Error joining rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to join rescue squad' },
      { status: 500 }
    );
  }
}
