import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
            activeCases: true,
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
        { error: 'Rescue squad not found' },
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
      { error: 'Failed to fetch rescue squad' },
      { status: 500 }
    );
  }
}
