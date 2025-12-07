import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/assignments/[id]/search-areas - Get all search areas for a case
export async function GET(request, { params }) {
  try {
    const { id: assignmentId } = params;

    const searchAreas = await prisma.searchArea.findMany({
      where: { assignmentId },
      include: {
        markedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { markedAt: 'desc' },
    });

    return NextResponse.json({ searchAreas });
  } catch (error) {
    console.error('Error fetching search areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search areas' },
      { status: 500 }
    );
  }
}

// POST /api/assignments/[id]/search-areas - Mark a new search area
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assignmentId } = params;
    const body = await request.json();
    const { geometry, acreage, notes, potentialSpotting = false, startAddress } = body;

    if (!geometry || !acreage) {
      return NextResponse.json(
        { error: 'Geometry and acreage required' },
        { status: 400 }
      );
    }

    // Verify user is a participant
    const participant = await prisma.caseParticipant.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
    });

    if (!participant || !participant.isActive) {
      return NextResponse.json(
        { error: 'You must be participating in this case to mark search areas' },
        { status: 403 }
      );
    }

    const searchArea = await prisma.searchArea.create({
      data: {
        assignmentId,
        markedById: session.user.id,
        geometry: JSON.stringify(geometry),
        acreage,
        notes,
        potentialSpotting,
        startAddress,
      },
      include: {
        markedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update participant stats
    await prisma.caseParticipant.update({
      where: { id: participant.id },
      data: {
        areasMarked: { increment: 1 },
      },
    });

    // Update assignment stats
    await prisma.caseAssignment.update({
      where: { id: assignmentId },
      data: {
        areasSearched: { increment: 1 },
      },
    });

    // Update user and squad member stats
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        areasMarkedCount: { increment: 1 },
        totalAcreageSearched: { increment: acreage },
      },
    });

    const squadMember = await prisma.rescueSquadMember.findFirst({
      where: {
        userId: session.user.id,
        rescueSquad: {
          caseAssignments: {
            some: { id: assignmentId },
          },
        },
        isActive: true,
      },
    });

    if (squadMember) {
      await prisma.rescueSquadMember.update({
        where: { id: squadMember.id },
        data: {
          areasMarked: { increment: 1 },
          searchHours: { increment: acreage * 0.25 }, // Estimate: ~15min per acre
        },
      });
    }

    // Update squad stats
    const assignment = await prisma.caseAssignment.findUnique({
      where: { id: assignmentId },
      select: { rescueSquadId: true },
    });

    await prisma.rescueSquad.update({
      where: { id: assignment.rescueSquadId },
      data: {
        totalAcreageSearched: { increment: acreage },
      },
    });

    // Check if user should level up (SENTRY → SHEPHERD: 5+ areas, 15+ acres)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (
      user.rescueLevel === 'SENTRY' &&
      user.areasMarkedCount >= 5 &&
      user.totalAcreageSearched >= 15
    ) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { rescueLevel: 'SHEPHERD' },
      });
    }

    return NextResponse.json({ searchArea }, { status: 201 });
  } catch (error) {
    console.error('Error marking search area:', error);
    return NextResponse.json(
      { error: 'Failed to mark search area' },
      { status: 500 }
    );
  }
}
