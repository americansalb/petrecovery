import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/missions/[id]/assignments - Get all squad assignments for a case
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const assignments = await prisma.caseAssignment.findMany({
      where: { missionId: id },
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            rescueSquadLevel: true,
            successfulReunions: true,
          },
        },
        participants: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                rescueLevel: true,
              },
            },
          },
        },
        _count: {
          select: {
            participants: true,
            searchAreas: true,
            petSpottings: true,
          },
        },
      },
      orderBy: { acceptedAt: 'asc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

// POST /api/missions/[id]/assignments - Squad leader accepts a case
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: missionId } = params;
    const body = await request.json();
    const { rescueSquadId } = body;

    if (!rescueSquadId) {
      return NextResponse.json(
        { error: 'Rescue squad ID required' },
        { status: 400 }
      );
    }

    // Check if case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    if (missionRecord.status === 'REUNITED' || missionRecord.status === 'CLOSED_OTHER') {
      return NextResponse.json(
        { error: 'This case is already closed' },
        { status: 400 }
      );
    }

    // Check if user is a leader of the squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId,
        userId: session.user.id,
        role: { in: ['FOUNDER', 'LEADER'] },
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only squad leaders can accept cases' },
        { status: 403 }
      );
    }

    // Check if squad already accepted this case
    const existingAssignment = await prisma.caseAssignment.findUnique({
      where: {
        missionId_rescueSquadId: {
          missionId,
          rescueSquadId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Your squad has already accepted this case' },
        { status: 400 }
      );
    }

    // Create the assignment
    const assignment = await prisma.caseAssignment.create({
      data: {
        missionId,
        rescueSquadId,
        acceptedById: session.user.id,
        status: 'ACCEPTED',
      },
      include: {
        case: {
          select: {
            caseNumber: true,
            petName: true,
            petSpecies: true,
            petPhotoUrl: true,
            lastSeenAddress: true,
          },
        },
        rescueSquad: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update case status to IN_PROGRESS
    await prisma.case.update({
      where: { id: missionId },
      data: {
        status: 'IN_PROGRESS',
        activeSearchers: { increment: 1 },
      },
    });

    // Update squad stats
    await prisma.rescueSquad.update({
      where: { id: rescueSquadId },
      data: {
        totalMissionsAccepted: { increment: 1 },
      },
    });

    // TODO: Send notifications to all active squad members
    // - Push notification: "Your squad accepted a new case!"
    // - Email: Mission details with opt-in link

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error('Error accepting case:', error);
    return NextResponse.json(
      { error: 'Failed to accept case' },
      { status: 500 }
    );
  }
}
