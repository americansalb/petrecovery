import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/:id/divisions/:divisionId - Get division details
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Fetch division with all related data
    const division = await prisma.division.findUnique({
      where: { id: params.divisionId },
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            members: {
              where: { isActive: true },
              select: {
                userId: true,
                role: true,
              },
            },
          },
        },
        members: {
          where: { isActive: true, divisionId: params.divisionId },
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
            { role: 'asc' },
            { joinedAt: 'asc' },
          ],
        },
        _count: {
          select: {
            members: {
              where: { isActive: true, divisionId: params.divisionId }
            },
          },
        },
      },
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    // Verify division belongs to the specified squad
    if (division.rescueSquadId !== params.id) {
      return NextResponse.json(
        { error: 'Division does not belong to this rescue squad' },
        { status: 400 }
      );
    }

    // Check if current user is a member of the division
    let userDivisionMembership = null;
    if (userId) {
      userDivisionMembership = division.members.find(m => m.userId === userId);
    }

    // Check if current user is a squad member (even if not division member)
    let isSquadMember = false;
    if (userId) {
      isSquadMember = division.rescueSquad.members.some(m => m.userId === userId);
    }

    // Return division data with squad context
    return NextResponse.json({
      division: {
        ...division,
        isMember: !!userDivisionMembership,
        userRole: userDivisionMembership?.role || null,
      },
      squad: division.rescueSquad,
      isSquadMember,
    });
  } catch (error) {
    console.error('Error fetching division:', error);
    return NextResponse.json(
      { error: 'Failed to fetch division' },
      { status: 500 }
    );
  }
}
