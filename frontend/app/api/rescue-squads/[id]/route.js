import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/:id - Get single rescue squad details
export async function GET(request, { params }) {
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
      return NextResponse.json(
        { error: 'Rescue squad not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ squad });
  } catch (error) {
    console.error('Error fetching rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rescue squad' },
      { status: 500 }
    );
  }
}
