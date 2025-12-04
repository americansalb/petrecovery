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
            email: true,
            photoUrl: true,
            bio: true
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

    // Get user's divisions to calculate common groups
    const currentUserDivisions = await prisma.rescueSquadMember.findMany({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true
      },
      select: {
        divisionId: true,
        division: {
          select: { name: true }
        }
      }
    });

    const currentUserDivisionIds = currentUserDivisions
      .filter(m => m.divisionId)
      .map(m => m.divisionId);

    // Check friendships (assuming a friendships table exists)
    // For now, we'll just mark all as non-friends until friendship system is implemented
    const friendIds = new Set(); // TODO: Fetch actual friend IDs from friendships table

    // Format members with privacy controls
    const formattedMembers = members.map(member => {
      const isFriend = friendIds.has(member.user.id);
      const isCurrentUser = member.user.id === session.user.id;

      // Get common divisions
      const memberDivisions = member.divisionId ? [member.division.name] : [];
      const commonDivisions = memberDivisions.filter(name =>
        currentUserDivisions.some(d => d.division?.name === name)
      );

      return {
        id: member.id,
        userId: member.user.id,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        photoUrl: member.user.photoUrl,
        bio: member.user.bio,
        role: member.role,
        joinedAt: member.joinedAt,
        isFriend,
        commonDivisions,
        division: member.division
      };
    });

    return NextResponse.json({ members: formattedMembers });

  } catch (error) {
    console.error('Error fetching squad members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
