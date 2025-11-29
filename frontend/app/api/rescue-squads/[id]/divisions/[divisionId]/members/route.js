/**
 * Division Members API
 * POST: Add member to division
 * GET: List division members
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const squadId = params.id;
    const { divisionId } = params;

    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueSquadId: squadId,
        isActive: true,
      },
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
              }
            }
          },
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' },
          ]
        }
      }
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      members: division.members.map(m => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      }))
    });
  } catch (error) {
    console.error('Error fetching division members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const squadId = params.id;
    const { divisionId } = params;
    const { memberId } = await request.json();

    // Verify user has permission (founder, leader, or coordinator)
    const userMembership = await prisma.squadMembership.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['FOUNDER', 'LEADER', 'COORDINATOR'] },
      },
    });

    if (!userMembership) {
      return NextResponse.json(
        { error: 'Only leaders and coordinators can assign members' },
        { status: 403 }
      );
    }

    // Verify the division exists
    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        rescueSquadId: squadId,
        isActive: true,
      },
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    // Verify the member exists in the squad
    const memberToAdd = await prisma.squadMembership.findFirst({
      where: {
        id: memberId,
        rescueSquadId: squadId,
        isActive: true,
      },
    });

    if (!memberToAdd) {
      return NextResponse.json(
        { error: 'Member not found in squad' },
        { status: 404 }
      );
    }

    // Update the member's division
    await prisma.squadMembership.update({
      where: { id: memberId },
      data: { divisionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding member to division:', error);
    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    );
  }
}
