import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const forceId = params.id;
    const { searchParams } = new URL(request.url);
    const available = searchParams.get('available') === 'true';
    const excludeDivisionId = searchParams.get('divisionId');

    // Check if user is a member (for enhanced access)
    let userMembership = null;
    let currentUserDivisions = [];

    if (session?.user?.id) {
      userMembership = await prisma.rescueForceMember.findFirst({
        where: {
          rescueForceId: forceId,
          userId: session.user.id,
          isActive: true
        }
      });

      if (userMembership) {
        currentUserDivisions = await prisma.rescueForceMember.findMany({
          where: {
            rescueForceId: forceId,
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
      }
    }

    // Build the query based on filters
    const whereClause = {
      rescueForceId: forceId,
      isActive: true
    };

    // If looking for available members (not in the specified division)
    // This is a member-only feature
    if (userMembership && available && excludeDivisionId) {
      whereClause.OR = [
        { divisionId: null },
        { divisionId: { not: excludeDivisionId } }
      ];
    } else if (userMembership && available) {
      whereClause.divisionId = null;
    }

    // Fetch members
    const members = await prisma.rescueForceMember.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true
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

    // Check friendships (assuming a friendships table exists)
    // For now, we'll just mark all as non-friends until friendship system is implemented
    const friendIds = new Set(); // TODO: Fetch actual friend IDs from friendships table

    // Format members with privacy controls based on access level
    const formattedMembers = members.map(member => {
      const isFriend = friendIds.has(member.user.id);
      const isCurrentUser = session?.user?.id === member.user.id;
      const isMember = !!userMembership;

      // Get common divisions (only for members)
      let commonDivisions = [];
      if (isMember && member.divisionId) {
        const memberDivisions = [member.division.name];
        commonDivisions = memberDivisions.filter(name =>
          currentUserDivisions.some(d => d.division?.name === name)
        );
      }

      // Privacy controls:
      // - Non-logged-in users: first name only
      // - Logged-in non-members: first name only
      // - Members: first name + last initial (unless friend/self)
      // - Friends/self: full info
      const showFullName = isFriend || isCurrentUser;
      const showLastInitial = isMember && !showFullName;

      return {
        id: member.id,
        userId: member.user.id,
        firstName: member.user.firstName,
        lastName: showFullName ? member.user.lastName : (showLastInitial && member.user.lastName ? member.user.lastName.charAt(0) + '.' : null),
        profileImage: member.user.profileImage,
        role: member.role,
        joinedAt: member.joinedAt,
        isFriend,
        commonDivisions,
        division: isMember ? member.division : null
      };
    });

    return NextResponse.json({
      members: formattedMembers,
      isMember: !!userMembership
    });

  } catch (error) {
    console.error('Error fetching force members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
