import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/[id] - Get squad details
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const squad = await prisma.rescueSquad.findUnique({
      where: { id },
      include: {
        members: {
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
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        caseAssignments: {
          where: {
            status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] },
          },
          include: {
            case: {
              select: {
                id: true,
                caseNumber: true,
                petName: true,
                petSpecies: true,
                petPhotoUrl: true,
                status: true,
                lastSeenAddress: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                participants: true,
              },
            },
          },
          orderBy: { acceptedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            members: true,
            caseAssignments: true,
          },
        },
      },
    });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    return NextResponse.json({ squad });
  } catch (error) {
    console.error('Error fetching squad:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squad' },
      { status: 500 }
    );
  }
}

// PATCH /api/rescue-squads/[id] - Update squad (leaders only)
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    // Check if user is squad leader
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: id,
        userId: session.user.id,
        role: { in: ['FOUNDER', 'LEADER'] },
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only squad leaders can update squad details' },
        { status: 403 }
      );
    }

    const updatedSquad = await prisma.rescueSquad.update({
      where: { id },
      data: {
        ...(body.description !== undefined && { description: body.description }),
        ...(body.radiusMiles !== undefined && { radiusMiles: body.radiusMiles }),
        ...(body.isAcceptingCases !== undefined && {
          isAcceptingCases: body.isAcceptingCases,
        }),
        ...(body.specializesInDogs !== undefined && {
          specializesInDogs: body.specializesInDogs,
        }),
        ...(body.specializesInCats !== undefined && {
          specializesInCats: body.specializesInCats,
        }),
        ...(body.specializesInBirds !== undefined && {
          specializesInBirds: body.specializesInBirds,
        }),
        ...(body.specializesInOther !== undefined && {
          specializesInOther: body.specializesInOther,
        }),
      },
    });

    return NextResponse.json({ squad: updatedSquad });
  } catch (error) {
    console.error('Error updating squad:', error);
    return NextResponse.json(
      { error: 'Failed to update squad' },
      { status: 500 }
    );
  }
}
