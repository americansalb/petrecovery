import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;
    const { searchParams } = new URL(request.url);
    const available = searchParams.get('available') === 'true';
    const excludeDivisionId = searchParams.get('divisionId');

    // Verify user is a member of this squad
    const userMembership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true
      }
    });

    if (!userMembership) {
      return NextResponse.json({ error: 'Not a squad member' }, { status: 403 });
    }

    // Build the query based on filters
    const whereClause = {
      rescueSquadId: squadId,
      isActive: true
    };

    // If looking for available members (not in the specified division)
    if (available && excludeDivisionId) {
      whereClause.OR = [
        { divisionId: null },
        { divisionId: { not: excludeDivisionId } }
      ];
    } else if (available) {
      whereClause.divisionId = null;
    }

    // Fetch members
    const members = await prisma.rescueSquadMember.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        division: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // Founders first, then leaders, then members
        { joinedAt: 'asc' }
      ]
    });

    return NextResponse.json({ members });

  } catch (error) {
    console.error('Error fetching squad members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
