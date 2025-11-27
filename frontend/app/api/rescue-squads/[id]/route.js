import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';

// GET /api/rescue-squads/:id - Get single rescue squad details
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  try {
    const { id } = await params;

    // Fetch squad data and active cases count in parallel
    const [squad, activeCasesCount] = await Promise.all([
      prisma.rescueSquad.findUnique({
        where: { id },
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
            },
          },
          _count: {
            select: {
              members: { where: { isActive: true } },
              caseAssignments: true,
            },
          },
        },
      }),
      // Count only active case assignments (ACCEPTED or ACTIVE status)
      prisma.caseAssignment.count({
        where: {
          rescueSquadId: id,
          status: { in: ['ACCEPTED', 'ACTIVE'] }
        }
      })
    ]);

    if (!squad) {
      await logEvent({
        event_type: 'squad.detail_failed',
        resource_type: 'rescue_squad',
        resource_id: id,
        action: 'read',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: `Squad not found: ${id}`,
        actor_user_id: session?.user?.id || null,
        actor_role: session?.user?.role || 'anonymous',
        metadata: { squad_id: id }
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

    // Add computed activeCases to the squad response
    return NextResponse.json({
      squad: {
        ...squad,
        activeCases: activeCasesCount
      }
    });
  } catch (error) {
    const { id } = await params;

    await logEvent({
      event_type: 'squad.detail_failed',
      resource_type: 'rescue_squad',
      resource_id: id,
      action: 'read',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'anonymous',
      metadata: {
        squad_id: id,
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
