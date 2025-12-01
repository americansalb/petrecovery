/**
 * User Squads API
 *
 * GET /api/user/squads - Get all squads the current user is a member of
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all squads where user is a member
    const memberships = await prisma.squadMember.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            displayName: true,
            city: true,
            state: true,
            isDeleted: true,
            _count: {
              select: {
                members: {
                  where: { isActive: true }
                },
                caseAssignments: {
                  where: {
                    status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });

    // Format the squads for the response
    const squads = memberships
      .filter(m => !m.rescueSquad.isDeleted)
      .map(m => ({
        id: m.rescueSquad.id,
        name: m.rescueSquad.name,
        displayName: m.rescueSquad.displayName,
        city: m.rescueSquad.city,
        state: m.rescueSquad.state,
        role: m.role,
        memberCount: m.rescueSquad._count.members,
        activeCases: m.rescueSquad._count.caseAssignments,
        joinedAt: m.joinedAt
      }));

    return NextResponse.json({ squads });

  } catch (error) {
    console.error('Error fetching user squads:', error);
    return NextResponse.json({
      error: 'Failed to fetch squads',
      message: error.message
    }, { status: 500 });
  }
}
