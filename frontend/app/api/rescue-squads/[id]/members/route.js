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

    // Fetch all active members
    const members = await prisma.rescueSquadMember.findMany({
      where: {
        rescueSquadId: squadId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
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
